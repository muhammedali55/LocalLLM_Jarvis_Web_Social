#!/usr/bin/env bash
# Tarayıcısız Jarvis: yerel servisleri açar, sonra arka plan dinleyicisini başlatır.
# "Jarvis, ..." diye konuşmanız yeterli; "Jarvis, kapat" ile uykuya döner.
set -euo pipefail
cd "$(dirname "$0")"
RUN=.run; mkdir -p "$RUN"
./start-local.sh >/dev/null
if [ -f "$RUN/jarvis.pid" ] && kill -0 "$(cat "$RUN/jarvis.pid")" 2>/dev/null; then
  echo "Jarvis zaten arka planda çalışıyor."; exit 0
fi
nohup .venv/bin/python daemon/jarvis_daemon.py >"$RUN/jarvis.log" 2>&1 &
echo $! >"$RUN/jarvis.pid"
sleep 2
if kill -0 "$(cat "$RUN/jarvis.pid")" 2>/dev/null; then
  echo "Jarvis arka planda dinliyor. \"Jarvis\" diye seslenin.  (durdurmak: ./stop-jarvis.sh, log: .run/jarvis.log)"
else
  echo "Jarvis başlatılamadı; .run/jarvis.log dosyasına bakın."; tail -5 "$RUN/jarvis.log"; exit 1
fi
