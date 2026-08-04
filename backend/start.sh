#!/bin/bash
set -e

echo "[start] POT provider path: $POT_PROVIDER_PATH"
echo "[start] yt-dlp version: $(yt-dlp --version)"

if [ -d "$POT_PROVIDER_PATH" ]; then
  echo "[start] Starting POT provider server..."
  node "$POT_PROVIDER_PATH/build/main.js" &
  POT_PID=$!

  for i in $(seq 1 15); do
    if curl -sf "http://127.0.0.1:4416/ping" >/dev/null 2>&1; then
      echo "[start] POT provider server is up (attempt $i)"
      break
    fi
    if ! kill -0 "$POT_PID" 2>/dev/null; then
      echo "[start] WARNING: POT provider process died"
      break
    fi
    sleep 1
  done

  if curl -sf "http://127.0.0.1:4416/ping" >/dev/null 2>&1; then
    echo "[start] POT provider healthy at http://127.0.0.1:4416"
  else
    echo "[start] WARNING: POT provider NOT reachable at 127.0.0.1:4416 — continuing without tokens"
  fi
else
  echo "[start] POT provider not found at $POT_PROVIDER_PATH, running without it"
fi

trap 'if [ -n "$POT_PID" ]; then kill "$POT_PID" 2>/dev/null || true; fi' EXIT

echo "[start] Starting backend..."
exec node index.js
