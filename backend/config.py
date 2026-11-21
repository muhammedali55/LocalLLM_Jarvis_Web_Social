"""Yerel ayarlar. Bütün adresler loopback'tir; dış servis yoktur."""
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent.parent

# Yerel model çalıştırıcı: Ollama (yalnızca 127.0.0.1)
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
# Qwen4 bulunamadığı için kullanıcı onayıyla qwen3.8 kullanılıyor (bkz. docs/PREFLIGHT.md)
QWEN_MODEL = os.environ.get("QWEN_MODEL", "qwen3.8")
# Model çekim boyunca bellekte kalsın
OLLAMA_KEEP_ALIVE = "60m"

# Yerel ASR: whisper.cpp
WHISPER_BIN = os.environ.get("WHISPER_BIN", "whisper-cli")
WHISPER_MODEL = Path(os.environ.get("WHISPER_MODEL", ROOT / "models" / "ggml-large-v3-turbo.bin"))
FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "ffmpeg")

# Yerel TTS: önce yazgı-tts-1 (127.0.0.1:8777), kapalıysa macOS `say -v Yelda`
YAZGI_URL = os.environ.get("YAZGI_URL", "http://127.0.0.1:8777")
YAZGI_VOICE = os.environ.get("YAZGI_VOICE", "male-01")
TTS_VOICE = os.environ.get("TTS_VOICE", "Yelda")

BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8765"))
