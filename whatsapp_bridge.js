const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');

// ⚠️ APNA WHATSAPP NUMBER YAHAN BINA HASH/PLUS KE DAALEIN (E.g., "919876543210")
const MY_PHONE_NUMBER = "91XXXXXXXXXX"; 

const client = new Client({
    authStrategy: new LocalAuth(),
    puppetShowBrowser: false,
    authTimeoutMs: 90000,
    qrTimeoutMs: 60000,
    restartOnAuthFail: true,
    takeoverTimeoutMs: 120000,
    takeoverOnConflict: true,
    bypassCSP: true,
    
    // STRICT PATHS HATA DIYE - AB RENDER KA DEFAULT ENGINE ISKO AUTOMATIC DEKHEGA
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--single-process'
        ]
    }
});

const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

client.on('qr', (qr) => {}); // Silent

client.on('ready', () => {
    console.log('🟢 WhatsApp Bridge Connection Active!');
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

client.on('disconnected', () => { client.initialize(); });

// ENGINE INITIALIZE HOTE HI DIRECT OTP GENERATE HOGA
client.initialize().then(async () => {
    try {
        console.log(`⏳ Requesting 8-Digit OTP Code for ${MY_PHONE_NUMBER}...`);
        setTimeout(async () => {
            const pairingCode = await client.requestPairingCode(MY_PHONE_NUMBER);
            console.log("\n==========================================");
            console.log(`🔑 APKA WHATSAPP OTP CODE HAI: ${pairingCode}`);
            console.log("==========================================\n");
        }, 5000);
    } catch (codeErr) {
        console.log("OTP Status Check:", codeErr.message);
    }
});
