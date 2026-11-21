"""Yerel ses: whisper.cpp ile ASR, macOS `say` ile TTS.

Ses dosyaları yalnızca geçici bir klasörde, işlem süresince tutulur ve hemen silinir.
"""
import asyncio
import logging
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import httpx

from . import config

log = logging.getLogger("yerel.speech")


class SpeechError(RuntimeError):
    pass


async def _run(cmd: list[str], timeout: float = 120) -> subprocess.CompletedProcess:
    return await asyncio.to_thread(
        subprocess.run, cmd, capture_output=True, text=True, timeout=timeout
    )


async def transcribe(audio: bytes, filename: str = "kayit.webm") -> dict:
    if not config.WHISPER_MODEL.exists():
        raise SpeechError(f"Whisper modeli bulunamadı: {config.WHISPER_MODEL}")
    t0 = time.perf_counter()
    tmp = Path(tempfile.mkdtemp(prefix="jarvis-"))
    try:
        src = tmp / (Path(filename).name or "kayit.webm")
        wav = tmp / "ses.wav"
        src.write_bytes(audio)
        conv = await _run([config.FFMPEG_BIN, "-nostdin", "-loglevel", "error", "-y",
                           "-i", str(src), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(wav)])
        if conv.returncode != 0:
            raise SpeechError("Ses dönüştürülemedi (ffmpeg): " + conv.stderr.strip()[:200])
        log.info("-> yerel whisper.cpp (%s)", config.WHISPER_MODEL.name)
        res = await _run([config.WHISPER_BIN, "-m", str(config.WHISPER_MODEL), "-l", "tr",
                          "-nt", "-np", "-t", "8", "--prompt", "Jarvis, yerel yapay zekâ.",
                          "-f", str(wav)])
        if res.returncode != 0:
            raise SpeechError("Ses tanıma başarısız (whisper.cpp): " + res.stderr.strip()[-200:])
        text = " ".join(line.strip() for line in res.stdout.splitlines() if line.strip())
        elapsed = time.perf_counter() - t0
        log.info("<- yerel whisper.cpp: %.2f sn", elapsed)
        return {"text": text, "seconds": round(elapsed, 2), "engine": f"whisper.cpp / {config.WHISPER_MODEL.name}"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


_MD = re.compile(r"[*_#`>~\[\]]")


def clean_for_speech(text: str) -> str:
    text = _MD.sub("", text)
    text = re.compile("[\U0001F300-\U0001FAFF☀-➿]").sub("", text)
    return re.sub(r"\s+", " ", text).strip()


async def _yazgi(text: str) -> bytes | None:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{config.YAZGI_URL}/tts", json={"text": text, "voice": config.YAZGI_VOICE})
        if r.status_code == 200 and r.content[:4] == b"RIFF":
            return r.content
        log.warning("yazgı TTS hata döndürdü (%s), Yelda'ya geçiliyor", r.status_code)
    except httpx.HTTPError:
        log.warning("yazgı TTS servisine ulaşılamadı, Yelda'ya geçiliyor")
    return None


async def synthesize(text: str) -> bytes:
    text = clean_for_speech(text)
    if not text:
        raise SpeechError("Okunacak metin boş.")
    log.info("-> yerel yazgı TTS %s (ses=%s)", config.YAZGI_URL, config.YAZGI_VOICE)
    wav = await _yazgi(text)
    if wav:
        return wav
    return await _say(text)


async def _say(text: str) -> bytes:
    tmp = Path(tempfile.mkdtemp(prefix="jarvis-tts-"))
    try:
        out = tmp / "yanit.wav"
        txt = tmp / "yanit.txt"
        txt.write_text(text, encoding="utf-8")
        log.info("-> yerel macOS say (ses=%s)", config.TTS_VOICE)
        res = await _run(["say", "-v", config.TTS_VOICE, "--file-format=WAVE",
                          "--data-format=LEI16@22050", "-o", str(out), "-f", str(txt)])
        if res.returncode != 0 or not out.exists():
            raise SpeechError("Yerel TTS başarısız (say): " + res.stderr.strip()[:200])
        return out.read_bytes()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


async def status() -> dict:
    whisper_ok = shutil.which(config.WHISPER_BIN) is not None and config.WHISPER_MODEL.exists()
    ffmpeg_ok = shutil.which(config.FFMPEG_BIN) is not None
    voices = (await _run(["say", "-v", "?"], timeout=10)).stdout
    voice_ok = any(line.split()[0] == config.TTS_VOICE for line in voices.splitlines() if line.strip())
    yazgi = None
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            yazgi = (await client.get(f"{config.YAZGI_URL}/health")).json()
    except Exception:
        yazgi = None
    if yazgi and yazgi.get("ok"):
        tts = {"ok": True, "engine": "yazgı-tts-1", "voice": config.YAZGI_VOICE, "fallback": f"macOS say {config.TTS_VOICE}"}
    else:
        tts = {"ok": voice_ok, "engine": "macOS say (yedek)", "voice": config.TTS_VOICE,
               "warning": "yazgı TTS kapalı; Yelda kullanılıyor"}
    return {
        "asr": {"ok": whisper_ok and ffmpeg_ok, "engine": "whisper.cpp", "model": config.WHISPER_MODEL.name,
                "model_present": config.WHISPER_MODEL.exists(), "ffmpeg": ffmpeg_ok},
        "tts": tts,
    }
