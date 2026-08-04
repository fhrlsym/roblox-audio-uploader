#!/bin/bash
set -e

echo "[start] yt-dlp version: $(yt-dlp --version)"

echo "[start] Starting backend..."
exec node index.js
