#!/usr/bin/env bash
# Yerel İnternet — tek seferlik kurulum (internet AÇIKKEN çalıştırın).
# One-time setup (run while ONLINE). Afterwards everything works offline.
#
# Kullanım / Usage:
#   ./setup.sh               # her şeyi kur / install everything
#   ./setup.sh --no-yazgi    # Türkçe neural TTS'i atla (macOS "Yelda" sesi kullanılır)
#   QWEN_MODEL=qwen3:14b ./setup.sh   # farklı bir Ollama modeli / a different Ollama model
#
# Proje klasörü dışına yalnızca Ollama modelleri (~/.ollama) yazılır.
# Only Ollama models are stored outside the project folder (~/.ollama).
set -euo pipefail
cd "$(dirname "$0")"

QWEN_MODEL="${QWEN_MODEL:-qwen3.8}"
WHISPER_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin"
YAZGI_WHEEL="https://huggingface.co/erkamk/yazgi-tts-1/resolve/main/dist/yazgi_tts-0.1.0-py3-none-any.whl"
WITH_YAZGI=1
[ "${1:-}" = "--no-yazgi" ] && WITH_YAZGI=0

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
need() { command -v "$1" >/dev/null 2>&1; }

say "1/7 Ön kontrol / Preflight"
[ "$(uname -s)" = "Darwin" ] || { echo "Bu proje macOS (Apple Silicon) için hazırlandı."; exit 1; }
missing=()
for t in whisper-cli ffmpeg node npm uv ollama; do need "$t" || missing+=("$t"); done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Eksik araçlar / missing tools: ${missing[*]}"
  echo "Kurulum önerisi / suggested install:"
  echo "  brew install whisper-cpp ffmpeg node uv"
  echo "  Ollama: https://ollama.com/download"
  exit 1
fi
echo "Tamam: whisper-cli, ffmpeg, node, uv, ollama bulundu."

say "2/7 Ollama modelleri / Ollama models ($QWEN_MODEL, nomic-embed-text)"
curl -s -m 2 http://127.0.0.1:11434/api/version >/dev/null || { (open -a Ollama 2>/dev/null || (nohup ollama serve >/dev/null 2>&1 &)); sleep 3; }
ollama pull "$QWEN_MODEL"
ollama pull nomic-embed-text

say "3/7 Whisper modeli / Whisper model (large-v3-turbo, ~1.6 GB)"
mkdir -p models
if [ ! -s models/ggml-large-v3-turbo.bin ]; then
  curl -L --fail -o models/ggml-large-v3-turbo.bin "$WHISPER_URL"
else
  echo "Zaten var / already present."
fi

say "4/7 Python ortamı / Python environment (.venv)"
[ -x .venv/bin/python ] || uv venv .venv
uv pip install --python .venv/bin/python -r backend/requirements.txt

say "5/7 Arayüz paketleri / Frontend packages"
npm --prefix frontend install

if [ "$WITH_YAZGI" = 1 ]; then
  say "6/7 Türkçe ses / Turkish TTS (yazgı-tts-1, Apache-2.0, ~0.6 GB)"
  [ -x tts/.venv/bin/python ] || uv venv --python 3.12 tts/.venv
  uv pip install --python tts/.venv/bin/python "yazgi-tts[hub] @ $YAZGI_WHEEL"
  HF_HOME="$PWD/tts/hf-cache" tts/.venv/bin/python -c \
    "from huggingface_hub import snapshot_download as d; d('erkamk/yazgi-tts-1', allow_patterns=['config.json','model.pt','codec.pt','voices/*'])"
else
  say "6/7 yazgı atlandı / skipped — macOS 'say -v Yelda' kullanılacak"
fi

say "7/7 Bitti / Done"
cat <<EOF

Şimdi Wi-Fi'yi kapatabilirsiniz. / You can turn Wi-Fi off now.

  ./start-local.sh      # web arayüzü / web UI  → http://127.0.0.1:5173
  ./start-jarvis.sh     # tarayıcısız Jarvis / browser-less Jarvis ("Jarvis, ...")
  ./stop-jarvis.sh && ./stop-local.sh

Not: Qwen dışında bir model kullandıysanız başlatırken de belirtin:
     QWEN_MODEL=$QWEN_MODEL ./start-local.sh
EOF
