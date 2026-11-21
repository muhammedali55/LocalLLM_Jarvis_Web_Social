#!/usr/bin/env bash
# Backend ve arayüzü durdurur. Ollama'ya dokunmaz (başka uygulamalar da kullanıyor olabilir).
cd "$(dirname "$0")"
for name in frontend backend yazgi; do
  f=".run/$name.pid"
  if [ -f "$f" ]; then
    pid=$(cat "$f")
    pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null && echo "$name durduruldu." || echo "$name zaten kapalı."
    rm -f "$f"
  fi
done
pkill -f "uvicorn backend.main:app --host 127.0.0.1 --port 8765" 2>/dev/null || true
lsof -ti tcp:5173 -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null || true
