#!/bin/bash
set -e

yt-dlp -U >/dev/null 2>&1 || true
echo "[start] yt-dlp version: $(yt-dlp --version)"
node /opt/bgutil-ytdlp-pot-provider/server/build/main.js --port 4416 &
POT_PID=$!
sleep 2
if kill -0 "$POT_PID" 2>/dev/null; then
  echo "[start] PO Token provider: ready"
else
  echo "[start] PO Token provider: unavailable, continuing with yt-dlp fallback"
fi
echo "[start] Starting backend..."
exec node index.js
