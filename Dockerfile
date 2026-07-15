FROM ghcr.io/puppeteer/puppeteer:24.1.1

USER root
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["node", "whatsapp_bridge.js"]
