FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

WORKDIR /srv/backend

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3001
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
EXPOSE 3001

CMD ["bash", "start.sh"]
