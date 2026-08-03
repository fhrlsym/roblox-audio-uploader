FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    git \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Install the yt-dlp plugin and its local PO Token provider.
RUN mkdir -p /etc/yt-dlp/plugins \
    && curl -L -o /etc/yt-dlp/plugins/bgutil-ytdlp-pot-provider.zip \
       https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/1.3.1/bgutil-ytdlp-pot-provider.zip \
    && git clone --single-branch --branch 1.3.1 --depth 1 \
       https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil \
    && cd /opt/bgutil/server \
    && npm ci \
    && npx tsc

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENV PORT=3001
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
EXPOSE 3001

CMD ["/start.sh"]
