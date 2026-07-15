FROM node:20-slim

# Linux updates aur Chromium browser dependencies install karne ke liye
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    wget \
    ca-certificates \
    procps \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer ko external chrome download karne se rokne ke liye
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# DOCKER LINUX KA CORRECT DYNAMIC BROWSER PATH
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "whatsapp_bridge.js"]
