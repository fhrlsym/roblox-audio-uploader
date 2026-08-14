FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    aria2 \
    curl \
    unzip \
    ca-certificates \
    python3 \
    lua5.1 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod +x /usr/local/bin/yt-dlp \
    && curl -L -o /tmp/luau.zip https://github.com/luau-lang/luau/releases/download/0.733/luau-ubuntu.zip \
    && unzip -o -j /tmp/luau.zip luau -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/luau \
    && rm /tmp/luau.zip \
    && curl -L -o /tmp/lune.zip https://github.com/lune-org/lune/releases/download/v0.10.4/lune-0.10.4-linux-x86_64.zip \
    && unzip -o -j /tmp/lune.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/lune \
    && rm /tmp/lune.zip

WORKDIR /srv/backend

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3001
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
EXPOSE 3001

CMD ["bash", "start.sh"]