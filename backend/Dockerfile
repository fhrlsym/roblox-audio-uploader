FROM node:22-bookworm-slim

# Pinned yt-dlp version for deterministic builds & better layer caching.
# Bump YTDLP_VERSION to update.
ARG YTDLP_VERSION=2026.07.04

# yt-dlp_linux is a self-contained binary (bundles Python) so we don't need
# a system python3. ffmpeg is required for audio processing.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux \
    && chmod +x /usr/local/bin/yt-dlp

WORKDIR /srv/backend

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3001
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
EXPOSE 3001

CMD ["bash", "start.sh"]
