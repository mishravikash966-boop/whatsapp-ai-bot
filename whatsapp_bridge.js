const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Running instance setup
const client = new Client({
    authStrategy: new LocalAuth(),
    puppetShowBrowser: false,
    authTimeoutMs: 60000,
    qrTimeoutMs: 60000,
    restartOnAuthFail: true,
    takeoverTimeoutMs: 120000,
    takeoverOnConflict: true,
    bypassCSP: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ]
});

const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

client.on('qr', (qr) => {
    console.log('🔄 QR generated (If logged out):');
    qrcode.generate(qr, { small: true });
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

        // 🎯 CASE 1: ROUTING AS DOCUMENT ATTACHMENT (Jaise PDF bina crash hue jaati hai)
        if (apiData.status === "success" && apiData.send_type === "document") {
            console.log(`📁 Processing Audio Document from: ${apiData.file_url}`);
            
            // Text caption pehle jayega
            if (apiData.reply) {
                await client.sendMessage(msg.from, apiData.reply);
            }

            // Audio Media chunk download aur dispatch pipeline
            const media = await MessageMedia.fromUrl(apiData.file_url);
            await client.sendMessage(msg.from, media);
            
            console.log("📄 Audio file injected and sent successfully!");
        } 
        
        // 🎯 CASE 2: NORMAL TEXT RESPONSE TIER
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
