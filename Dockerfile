FROM ghcr.io/puppeteer/puppeteer:24.1.1

USER root

WORKDIR /app

COPY package*.json ./
# 🎯 npm ci ki jagah npm install use kar rahe hain jo crash nahi hoga
RUN npm install

COPY . .

CMD ["node", "whatsapp_bridge.js"]
