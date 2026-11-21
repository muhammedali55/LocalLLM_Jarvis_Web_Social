#!/usr/bin/env bash
# Yerel İnternet: backend (127.0.0.1:8765) + arayüz (127.0.0.1:5173). Hiçbir şey LAN'a açılmaz.
set -euo pipefail
cd "$(dirname "$0")"
RUN=.run; mkdir -p "$RUN"

# 1) Yerel Qwen (Ollama) açık mı?
if ! curl -s -m 2 http://127.0.0.1:11434/api/version >/dev/null; then
  echo "Ollama kapalı, başlatılıyor…"
  (open -a Ollama 2>/dev/null || (nohup ollama serve >"$RUN/ollama.log" 2>&1 &))
  for _ in $(seq 1 20); do curl -s -m 1 http://127.0.0.1:11434/api/version >/dev/null && break; sleep 0.5; done
fi
MODEL="${QWEN_MODEL:-qwen3.8}"
echo "Qwen modeli belleğe yükleniyor ($MODEL)…"
curl -s -m 120 http://127.0.0.1:11434/api/generate -d "{\"model\":\"$MODEL\",\"keep_alive\":\"60m\"}" >/dev/null || echo "Uyarı: model ön-yüklenemedi."

# 2) Yerel Türkçe ses (yazgı-tts-1, 127.0.0.1:8777). Yoksa backend Yelda'ya düşer.
# Ortam: tts/.venv (setup.sh kurar) ya da eski konum tts-eval/.venv-yazgi
YAZGI_PY=""
for c in "${YAZGI_PY_PATH:-}" tts/.venv/bin/python tts-eval/.venv-yazgi/bin/python; do
  [ -n "$c" ] && [ -x "$c" ] && { YAZGI_PY="$c"; break; }
done
if [ -n "$YAZGI_PY" ]; then
  if [ -f "$RUN/yazgi.pid" ] && kill -0 "$(cat "$RUN/yazgi.pid")" 2>/dev/null; then
    echo "yazgı TTS zaten çalışıyor."
  else
    nohup "$YAZGI_PY" tts/yazgi_server.py --port 8777 --voice "${YAZGI_VOICE:-male-01}" >"$RUN/yazgi.log" 2>&1 &
    echo $! >"$RUN/yazgi.pid"
    for _ in $(seq 1 40); do curl -s -m 1 http://127.0.0.1:8777/health >/dev/null && break; sleep 0.5; done
  fi
else
  echo "Uyarı: yazgı TTS kurulu değil; Yelda sesi kullanılacak."
fi

# 3) Backend
if [ ! -x .venv/bin/uvicorn ]; then echo "Önce kurulum: uv venv .venv && uv pip install --python .venv/bin/python -r backend/requirements.txt"; exit 1; fi
if [ -f "$RUN/backend.pid" ] && kill -0 "$(cat "$RUN/backend.pid")" 2>/dev/null; then
  echo "Backend zaten çalışıyor."
else
  nohup .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8765 >"$RUN/backend.log" 2>&1 &
  echo $! >"$RUN/backend.pid"
fi

# 4) Arayüz
if [ -f "$RUN/frontend.pid" ] && kill -0 "$(cat "$RUN/frontend.pid")" 2>/dev/null; then
  echo "Arayüz zaten çalışıyor."
else
  nohup npm --prefix frontend run dev >"$RUN/frontend.log" 2>&1 &
  echo $! >"$RUN/frontend.pid"
fi

for _ in $(seq 1 30); do curl -s -m 1 http://127.0.0.1:8765/api/health >/dev/null && curl -s -m 1 http://127.0.0.1:5173 >/dev/null && break; sleep 0.5; done
echo
curl -s http://127.0.0.1:8765/api/health | python3 -c 'import sys,json;h=json.load(sys.stdin);print("Qwen:",h["llm"]["model"],"OK" if h["llm"]["ok"] else "SORUN");print("ASR :",h["asr"]["model"],"OK" if h["asr"]["ok"] else "SORUN");print("TTS :",h["tts"]["engine"],h["tts"]["voice"],"OK" if h["tts"]["ok"] else "SORUN")' || echo "Backend yanıt vermiyor; .run/backend.log dosyasına bakın."
echo
echo "Açın: http://127.0.0.1:5173   (durdurmak için ./stop-local.sh)"
