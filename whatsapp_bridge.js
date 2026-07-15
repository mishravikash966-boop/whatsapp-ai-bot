const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');

// ⚠️ APNA WHATSAPP NUMBER YAHAN BINA HASH/PLUS KE DAALEIN (Jaise: 919876543210)
const MY_PHONE_NUMBER = "919876543210"; 

const client = new Client({
    authStrategy: new LocalAuth(),
    puppetShowBrowser: false,
    authTimeoutMs: 90000,
    qrTimeoutMs: 60000,
    restartOnAuthFail: true,
    takeoverTimeoutMs: 120000,
    takeoverOnConflict: true,
    bypassCSP: true,
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process',
            '--disable-extensions',
            '--js-flags="--max-old-space-size=256"'
        ]
    }
});

const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

// 🎯 QR CODE DISPLAY KO BLIND (BAND) KAR DIYA
client.on('qr', (qr) => {
    // QR code terminal par print nahi hoga, silent rahega
});

client.on('ready', () => {
    console.log('🟢 WhatsApp Bridge Connection Active & Authenticated!');
});

client.on('message', async (msg) => {
    if (msg.fromMe || msg.isGroup) return;
    try {
        console.log(`📩 Incoming: ${msg.body}`);
        const response = await axios.post(PYTHON_BACKEND_URL, {
            message: msg.body
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const apiData = response.data;
        if (apiData.status === "success" && apiData.send_type === "document") {
            if (apiData.reply) await client.sendMessage(msg.from, apiData.reply);
            const media = await MessageMedia.fromUrl(apiData.file_url);
            await client.sendMessage(msg.from, media);
        } else if (apiData.status === "success" && apiData.reply) {
            await client.sendMessage(msg.from, apiData.reply);
        }
    } catch (error) {
        console.error("❌ Exception:", error.message);
    }
});

client.on('disconnected', (reason) => {
    client.initialize();
});

// 🚀 ENGINE INITIALIZE HOTE HI DIRECT OTP GENERATE HOGA
client.initialize().then(async () => {
    try {
        console.log(`⏳ Requesting 8-Digit OTP Code for ${MY_PHONE_NUMBER}...`);
        // 2 second ka gap taaki engine initialize ho sake
        setTimeout(async () => {
            const pairingCode = await client.requestPairingCode(MY_PHONE_NUMBER);
            console.log("\n==========================================");
            console.log(`🔑 APKA WHATSAPP OTP CODE HAI: ${pairingCode}`);
            console.log("==========================================\n");
        }, 3000);
    } catch (codeErr) {
        console.log("OTP Request delayed/already logged in:", codeErr.message);
    }
});
