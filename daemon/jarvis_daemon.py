"""Arka planda çalışan Jarvis: tarayıcı sekmesi gerekmez.

- Mikrofon sürekli YEREL olarak dinlenir; ses diske yazılmaz, hiçbir yere gönderilmez
  (yalnızca 127.0.0.1'deki yerel backend'e).
- "Jarvis" diye başlayan bir cümle duyulunca uyanır, çerçevesiz reaktör penceresini açar ve
  sohbet moduna geçer. "Jarvis, kapat" denince ya da 25 sn sessizlikte tekrar uykuya döner.
- Jarvis konuşurken mikrofon yok sayılır (kendi sesini duymasın diye).

Çalıştırma: ./start-jarvis.sh   Durdurma: ./stop-jarvis.sh
"""
import io
import json
import logging
import os
import queue
import re
import threading
import time
import wave
from concurrent.futures import ThreadPoolExecutor

import httpx
import numpy as np
import sounddevice as sd
import webview

API = os.environ.get("JARVIS_API", "http://127.0.0.1:8765")
UI_URL = os.environ.get("JARVIS_UI", "http://127.0.0.1:5173/#overlay")
SR = 16000
FRAME = 320  # 20 ms

VAD = dict(prerollMs=400, startFrames=4, endSilenceMs=850, minSpeechMs=300, maxUttMs=30000,
           minAbs=0.010, startRatio=3.2, keepRatio=2.0, resumeGuardMs=450)
CONVO_TIMEOUT_S = 25

log = logging.getLogger("jarvis.daemon")

# Whisper "Jarvis"i bazen farklı yazar; hepsini kabul et
WAKE = re.compile(r"^\W*(?:hey\W+|hay\W+|ey\W+)?(?:j|c|ç|ş|ch|dj)[ae]r?v[iı](?:s|z|ş)\b\W*", re.I)


def norm(t: str) -> str:
    return t.replace("I", "ı").replace("İ", "i").lower().strip()


# ---------------- Pencere köprüsü ----------------
class UI:
    """Pencereye yapılan tüm çağrılar tek bir iş parçacığından, ses akışını hiç bekletmeden yapılır."""

    def __init__(self):
        self.win: webview.Window | None = None
        self.visible = False
        self._hide_timer: threading.Timer | None = None
        self._lock = threading.Lock()
        self._level = 0.0
        self._sent_level = -1.0
        threading.Thread(target=self._pump, daemon=True).start()

    def _js(self, code: str):
        if not self.win:
            return
        with self._lock:
            try:
                self.win.evaluate_js(code)
            except Exception:
                pass

    def _pump(self):
        # Ses seviyesini saniyede ~20 kez pencereye aktar (ses akışından bağımsız)
        while True:
            time.sleep(0.05)
            lv = self._level
            if self.visible and abs(lv - self._sent_level) >= 0.02:
                self._sent_level = lv
                self._js(f"window.__jarvisOverlay && window.__jarvisOverlay.level({lv:.3f})")

    def phase(self, p: str, **info):
        log.info("durum: %s", p)
        self._js(f"window.__jarvisOverlay && window.__jarvisOverlay.set({json.dumps(p)}, {json.dumps(info)})")

    def level(self, lv: float):
        self._level = lv  # yalnızca değişken yazımı: anında döner

    def show(self):
        if self._hide_timer:
            self._hide_timer.cancel()
            self._hide_timer = None
        if self.win and not self.visible:
            self.win.show()
            self.visible = True

    def hide_later(self, s: float = 2.4):
        def _h():
            if self.win and self.visible:
                self.win.hide()
                self.visible = False
        self._hide_timer = threading.Timer(s, _h)
        self._hide_timer.start()


# ---------------- Ses çalma ----------------
class Player:
    """Hoparlörün kendi hızında (48 kHz) sürekli açık tek bir çıkış akışı.

    Geri çağrı yalnızca hazır tampondan kopyalar; ağır iş yapmaz. Böylece cızırtı/kesinti olmaz.
    """

    def __init__(self, ui: UI):
        self.ui = ui
        dev = sd.query_devices(kind="output")
        self.sr = int(dev["default_samplerate"])
        self.buf = np.zeros(0, dtype=np.float32)
        self.lock = threading.Lock()
        self.drained = threading.Event()
        self.drained.set()
        self.underflows = 0
        self.stream = sd.OutputStream(samplerate=self.sr, channels=1, dtype="float32",
                                      blocksize=1024, latency="high", callback=self._cb)
        self.stream.start()
        log.info("ses çıkışı: %s, %d Hz", dev["name"], self.sr)

    def _cb(self, out, frames, _t, status):
        if status.output_underflow:
            self.underflows += 1
        with self.lock:
            n = min(frames, len(self.buf))
            out[:n, 0] = self.buf[:n]
            out[n:, 0] = 0
            chunk = self.buf[:n]
            self.buf = self.buf[n:]
            empty = len(self.buf) == 0
        self.ui.level(min(1.0, float(np.sqrt((chunk ** 2).mean())) / 0.11) if n else 0.0)
        if empty:
            self.drained.set()

    @staticmethod
    def decode(wav_bytes: bytes) -> tuple[np.ndarray, int]:
        with wave.open(io.BytesIO(wav_bytes)) as w:
            sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
            a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
        if ch > 1:
            a = a.reshape(-1, ch).mean(axis=1)
        return a, sr

    def _resample(self, a: np.ndarray, sr: int) -> np.ndarray:
        if sr == self.sr or not len(a):
            return a.astype(np.float32)
        n = int(round(len(a) * self.sr / sr))
        return np.interp(np.arange(n) * (sr / self.sr), np.arange(len(a)), a).astype(np.float32)

    def play(self, data: np.ndarray, sr: int):
        a = self._resample(data, sr)
        # Başta/sonda çok kısa yumuşatma: tık sesini önler
        f = min(len(a) // 2, int(self.sr * 0.004))
        if f:
            ramp = np.linspace(0, 1, f, dtype=np.float32)
            a[:f] *= ramp
            a[-f:] *= ramp[::-1]
        before = self.underflows
        with self.lock:
            self.buf = np.concatenate([self.buf, a])
            self.drained.clear()
        self.drained.wait(timeout=len(a) / self.sr + 5)
        time.sleep(self.stream.latency)  # donanım tamponundaki son parça da çalınsın
        if self.underflows > before:
            log.warning("ses kesintisi: %d", self.underflows - before)
        self.ui.level(0)

    def chime(self, freqs, gain=0.12):
        sr = self.sr
        parts = []
        for fq in freqs:
            t = np.arange(int(sr * 0.16)) / sr
            env = np.minimum(1, t / 0.01) * np.exp(-t * 22)
            parts.append((np.sin(2 * np.pi * fq * t) * env * gain).astype(np.float32))
        self.play(np.concatenate(parts), sr)


# ---------------- Ana döngü ----------------
class Jarvis:
    def __init__(self, ui: UI):
        self.ui = ui
        self.player = Player(ui)
        self.http = httpx.Client(base_url=API, timeout=120)
        self.pool = ThreadPoolExecutor(max_workers=3)
        self.q: queue.Queue[np.ndarray] = queue.Queue()
        self.mode = "sleep"  # sleep | convo
        self.mute_until = 0.0
        self.history: list[dict] = []
        self.last_activity = time.time()
        self.floor = 0.004

    # --- mikrofon ---
    def _mic_cb(self, indata, frames, _t, status):
        self.q.put(indata[:, 0].copy())

    def run(self):
        log.info("Jarvis arka planda: \"Jarvis\" demeniz yeterli. (mikrofon yerel, %s)", API)
        with sd.InputStream(samplerate=SR, channels=1, dtype="float32", blocksize=FRAME, callback=self._mic_cb):
            for utt in self._utterances():
                try:
                    self._handle(utt)
                except httpx.HTTPError as e:
                    log.warning("yerel backend hatası: %s", e)
                    self.ui.phase("error", error="Yerel backend'e ulaşılamadı (127.0.0.1:8765).")
                    time.sleep(2)
                    self._after_turn()
                except Exception:
                    log.exception("beklenmeyen hata")
                    self._after_turn()

    def _utterances(self):
        """Sessizlik algılama: konuşma parçalarını sırayla verir."""
        ring: list[np.ndarray] = []
        utt: list[np.ndarray] = []
        hearing = False
        voiced = silent_ms = speech_ms = utt_ms = 0
        max_ring = VAD["prerollMs"] // 20
        while True:
            try:
                f = self.q.get(timeout=0.5)
            except queue.Empty:
                f = None
            # Sohbet modunda uzun sessizlik → uyku
            if self.mode == "convo" and not hearing and time.time() - self.last_activity > CONVO_TIMEOUT_S:
                self._sleep(quiet=True)
            if f is None:
                continue
            if time.time() < self.mute_until:
                ring, utt, hearing, voiced = [], [], False, 0
                continue
            rms = float(np.sqrt((f * f).mean()))
            start_t = max(VAD["minAbs"], self.floor * VAD["startRatio"])
            keep_t = max(VAD["minAbs"] * 0.7, self.floor * VAD["keepRatio"])
            if not hearing:
                self.floor = self.floor * 0.9 + rms * 0.1 if rms < self.floor else self.floor * 0.995 + rms * 0.005
                ring.append(f)
                if len(ring) > max_ring:
                    ring.pop(0)
                voiced = voiced + 1 if rms > start_t else 0
                if self.mode == "convo":
                    self.ui.level(min(1.0, rms / 0.08))
                if voiced >= VAD["startFrames"]:
                    hearing, utt, ring = True, list(ring), []
                    speech_ms, utt_ms, silent_ms = voiced * 20, len(utt) * 20, 0
                    if self.mode == "convo":
                        self.ui.phase("hearing")
                continue
            utt.append(f)
            utt_ms += 20
            if self.mode == "convo":
                self.ui.level(min(1.0, rms / 0.08))
            if rms > keep_t:
                silent_ms, speech_ms = 0, speech_ms + 20
            else:
                silent_ms += 20
            if silent_ms >= VAD["endSilenceMs"] or utt_ms >= VAD["maxUttMs"]:
                hearing = False
                chunk, utt, voiced = np.concatenate(utt), [], 0
                if speech_ms >= VAD["minSpeechMs"]:
                    yield chunk
                elif self.mode == "convo":
                    self.ui.phase("listening")

    # --- bir tur ---
    def _transcribe(self, audio: np.ndarray) -> dict:
        pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm)
        r = self.http.post("/api/jarvis/transcribe", files={"audio": ("konusma.wav", buf.getvalue(), "audio/wav")})
        r.raise_for_status()
        return r.json()

    def _handle(self, audio: np.ndarray):
        if self.mode == "convo":
            self.ui.phase("transcribing")
        t = self._transcribe(audio)
        text = (t.get("text") or "").strip()
        if t.get("ignored") or not text:
            return self._after_turn() if self.mode == "convo" else None

        if self.mode == "sleep":
            m = WAKE.match(norm(text))
            if not m:
                log.info("uyandırma kelimesi yok, yok sayıldı")
                return
            rest = text[m.end():].strip(" ,.!?-")
            self._wake()
            if t.get("stop"):
                return self._sleep()
            if len(rest.split()) < 2:
                self._say(["Efendim, dinliyorum."])
                return self._after_turn()
            text = rest
        elif t.get("stop"):
            self._say(["Görüşmek üzere."])
            return self._sleep()

        self._answer(text)

    def _wake(self):
        log.info("uyandı")
        self.mode = "convo"
        self.history = []
        self.ui.show()
        self.ui.phase("listening")
        self.player.chime([660, 990])

    def _sleep(self, quiet=False):
        log.info("uykuya geçti")
        self.mode = "sleep"
        self.history = []
        self.ui.phase("done")
        if not quiet:
            self.player.chime([880, 440])
        self.ui.hide_later()
        self.mute_until = time.time() + VAD["resumeGuardMs"] / 1000

    def _after_turn(self):
        self.mute_until = time.time() + VAD["resumeGuardMs"] / 1000
        self.last_activity = time.time()
        while not self.q.empty():  # konuşurken biriken mikrofon sesini at
            self.q.get_nowait()
        if self.mode == "convo":
            self.ui.phase("listening")

    def _tts(self, text: str):
        r = self.http.post("/api/tts", json={"text": text})
        r.raise_for_status()
        return Player.decode(r.content)

    def _say(self, lines: list[str]):
        self.ui.phase("speaking")
        for fut in [self.pool.submit(self._tts, s) for s in lines]:
            self.player.play(*fut.result())

    def _answer(self, text: str):
        self.ui.phase("thinking")
        futures, answer, speaking = [], "", False
        with self.http.stream("POST", "/api/jarvis/stream", json={"text": text, "history": self.history[-6:]}) as r:
            r.raise_for_status()
            for line in r.iter_lines():
                if not line.strip():
                    continue
                e = json.loads(line)
                if e["type"] == "route" and e["mode"] == "search":
                    self.ui.phase("searching", notes=len(e["sources"]))
                elif e["type"] == "sentence":
                    futures.append(self.pool.submit(self._tts, e["text"]))
                    # İlk cümle hazırsa akış sürerken konuşmaya başla
                    while futures and futures[0].done():
                        if not speaking:
                            self.ui.phase("speaking")
                            speaking = True
                        self.player.play(*futures.pop(0).result())
                elif e["type"] == "done":
                    answer = e["text"]
                elif e["type"] == "error":
                    raise RuntimeError(e["message"])
        for fut in futures:
            if not speaking:
                self.ui.phase("speaking")
                speaking = True
            self.player.play(*fut.result())
        self.history += [{"role": "user", "content": text}, {"role": "assistant", "content": answer}]
        self.history = self.history[-8:]
        self._after_turn()


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s", datefmt="%H:%M:%S")
    ui = UI()
    jarvis = Jarvis(ui)
    screen = webview.screens[0] if webview.screens else None
    w, h = 420, 500
    x = (screen.width - w - 40) if screen else 100
    y = 60
    ui.win = webview.create_window(
        "Jarvis", UI_URL, width=w, height=h, x=x, y=y, frameless=True, easy_drag=True,
        on_top=True, transparent=True, hidden=True, background_color="#000000",
    )

    def start():
        threading.Thread(target=jarvis.run, daemon=True).start()

    webview.start(start)


if __name__ == "__main__":
    main()
