FROM node:22-bookworm-slim AS pot-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    python3 \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt/bgutil-ytdlp-pot-provider \
    && curl --fail --location https://github.com/Brainicism/bgutil-ytdlp-pot-provider/archive/refs/tags/1.3.1.tar.gz \
        | tar -xz --strip-components=1 -C /opt/bgutil-ytdlp-pot-provider \
    && cd /opt/bgutil-ytdlp-pot-provider/server \
    && npm ci \
    && npx tsc

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    aria2 \
    curl \
    unzip \
    ca-certificates \
    python3 \
    lua5.1 \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod +x /usr/local/bin/yt-dlp \
    && mkdir -p /root/.config/yt-dlp/plugins \
    && curl -L -o /root/.config/yt-dlp/plugins/bgutil-ytdlp-pot-provider.zip https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/1.3.1/bgutil-ytdlp-pot-provider.zip \
    && curl -L -o /tmp/luau.zip https://github.com/luau-lang/luau/releases/download/0.733/luau-ubuntu.zip \
    && unzip -o -j /tmp/luau.zip luau -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/luau \
    && rm /tmp/luau.zip \
    && curl -L -o /tmp/lune.zip https://github.com/lune-org/lune/releases/download/v0.10.4/lune-0.10.4-linux-x86_64.zip \
    && unzip -o -j /tmp/lune.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/lune \
    && rm /tmp/lune.zip

COPY --from=pot-builder /opt/bgutil-ytdlp-pot-provider /opt/bgutil-ytdlp-pot-provider

WORKDIR /srv/backend

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3001
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV YOUTUBE_POT_PROVIDER_URL=http://127.0.0.1:4416
EXPOSE 3001

CMD ["bash", "start.sh"]
