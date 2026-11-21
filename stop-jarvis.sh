#!/usr/bin/env bash
# Arka plan Jarvis dinleyicisini kapatır. Yerel servisleri de kapatmak için: ./stop-local.sh
cd "$(dirname "$0")"
f=.run/jarvis.pid
if [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; then echo "Jarvis durduruldu."; else echo "Jarvis zaten kapalı."; fi
rm -f "$f"
