"""Yerel Türkçe TTS servisi: yazgı-tts-1 (Apache-2.0).

Yalnızca 127.0.0.1'e bağlanır, internete çıkmaz (HF_HUB_OFFLINE=1).
Model bellekte tutulur; her istek bir metni 24 kHz 16-bit mono WAV'a çevirir.

Çalıştırma (proje kökünden):
  tts/.venv/bin/python tts/yazgi_server.py --port 8777 --voice male-01

Uç noktalar:
  GET  /health            -> {"ok": true, "voice": ..., "voices": [...]}
  POST /tts  {"text", "voice"?}  -> audio/wav
"""
import argparse
import io
import json
import logging
import os
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Model önbelleği: tts/hf-cache (setup.sh) ya da eski konum tts-eval/hf-cache
if "HF_HOME" not in os.environ:
    _old = ROOT / "tts-eval" / "hf-cache"
    os.environ["HF_HOME"] = str(_old if _old.exists() and not (ROOT / "tts" / "hf-cache").exists() else ROOT / "tts" / "hf-cache")
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

import numpy as np  # noqa: E402
import torch  # noqa: E402
from yazgi_tts import RATE, YazgiTTS  # noqa: E402

log = logging.getLogger("yerel.yazgi")
MAX_CHARS = 1500


def to_wav(audio) -> bytes:
    a = np.clip(np.asarray(audio, dtype=np.float32).reshape(-1), -1.0, 1.0)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((a * 32767.0).astype("<i2").tobytes())
    return buf.getvalue()


class Engine:
    def __init__(self, voice: str, threads: int):
        torch.set_num_threads(threads)
        t0 = time.perf_counter()
        self.tts = YazgiTTS(device="cpu")
        self.voice = voice
        self.lock = threading.Lock()
        self.tts.say("Hazırım.", voice=voice, seed=0)  # ısınma
        log.info("yazgı hazır: ses=%s, %.2f sn", voice, time.perf_counter() - t0)

    @property
    def voices(self):
        return list(getattr(self.tts, "voices", []))

    def synth(self, text: str, voice: str | None) -> bytes:
        with self.lock:  # aynı anda tek sentez
            t0 = time.perf_counter()
            audio = self.tts.say(text, voice=voice or self.voice, seed=0)
            wav = to_wav(audio)
            log.info("sentez %.2f sn (%d karakter)", time.perf_counter() - t0, len(text))
            return wav


ENGINE: Engine | None = None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # metin içeriğini loglama
        pass

    def _send(self, code: int, body: bytes, ctype: str):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False).encode(), "application/json")

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True, "engine": "yazgi-tts-1", "voice": ENGINE.voice, "voices": ENGINE.voices})
        self._json(404, {"error": "yok"})

    def do_POST(self):
        if self.path != "/tts":
            return self._json(404, {"error": "yok"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(min(n, 20000)) or b"{}")
            text = str(data.get("text", "")).strip()[:MAX_CHARS]
            voice = data.get("voice") or None
            if voice and voice not in ENGINE.voices:
                voice = None
            if not text:
                return self._json(400, {"error": "boş metin"})
            self._send(200, ENGINE.synth(text, voice), "audio/wav")
        except Exception as e:  # noqa: BLE001
            log.exception("sentez hatası")
            self._json(500, {"error": str(e)[:200]})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8777)
    ap.add_argument("--voice", default=os.environ.get("YAZGI_VOICE", "male-01"))
    ap.add_argument("--threads", type=int, default=4)
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s", datefmt="%H:%M:%S")
    global ENGINE
    ENGINE = Engine(a.voice, a.threads)
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    log.info("yazgı TTS yalnızca http://127.0.0.1:%d üzerinde", a.port)
    srv.serve_forever()


if __name__ == "__main__":
    main()
