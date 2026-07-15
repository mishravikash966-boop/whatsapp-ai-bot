const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');

// ⚠️ APNA WHATSAPP NUMBER YAHAN BINA HASH/PLUS KE DAALEIN (E.g., "919876543210")
const MY_PHONE_NUMBER = "919458708924"; 

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

// 🎯 QR CODE KI JAGAH DIRECT OTP GENERATION LOGIC
client.on('qr', async (qr) => {
    try {
        console.log("🔄 Requesting OTP Pairing Code for Number:", MY_PHONE_NUMBER);
        const pairingCode = await client.requestPairingCode(MY_PHONE_NUMBER);
        console.log("\n==========================================");
        console.log(`🔑 APKA WHATSAPP OTP CODE HAI: ${pairingCode}`);
        console.log("==========================================\n");
    } catch (err) {
        console.error("❌ OTP Generate karne me error aaya:", err.message);
    }
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
            console.log(`📁 Processing Audio Document from: ${apiData.file_url}`);
            if (apiData.reply) {
                await client.sendMessage(msg.from, apiData.reply);
            }
            const media = await MessageMedia.fromUrl(apiData.file_url);
            await client.sendMessage(msg.from, media);
            console.log("📄 Audio file injected and sent successfully!");
        } 
        else if (apiData.status === "success" && apiData.reply) {
            console.log(`💬 Dispatching Text: ${apiData.reply}`);
            await client.sendMessage(msg.from, apiData.reply);
        }

    } catch (error) {
        console.error("❌ Bridge Routing Core Exception:", error.message);
    }
});

client.on('disconnected', (reason) => {
    console.log('🔴 Session disconnected:', reason);
    client.initialize();
});

client.initialize();
