#!/bin/bash
set -e

if [ -d "$POT_PROVIDER_PATH" ]; then
  echo "Starting POT provider server..."
  node "$POT_PROVIDER_PATH/build/main.js" &
  POT_PID=$!
  sleep 3
else
  echo "POT provider not found at $POT_PROVIDER_PATH, running without it"
fi

trap 'if [ -n "$POT_PID" ]; then kill $POT_PID 2>/dev/null || true; fi' EXIT

echo "Starting backend..."
exec node index.js
