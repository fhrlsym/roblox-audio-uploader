FROM brainicism/bgutil-ytdlp-pot-provider:1.3.1 AS pot

FROM node:25-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
    && mkdir -p /etc/yt-dlp/plugins \
    && curl -L -o /etc/yt-dlp/plugins/bgutil-ytdlp-pot-provider.zip https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/latest/download/bgutil-ytdlp-pot-provider.zip

COPY --from=pot /app /opt/pot

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3001
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV POT_PROVIDER_PATH=/opt/pot
EXPOSE 3001

CMD ["bash", "start.sh"]
