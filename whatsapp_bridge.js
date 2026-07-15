const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Initialize WhatsApp Client
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

// Python Render Backend URL
const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

// Generate QR Code for Authentication
client.on('qr', (qr) => {
    console.log('🔄 Scan this QR Code to connect your WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Client Ready Event
client.on('ready', () => {
    console.log('🟢 WhatsApp Bridge is fully authenticated and ready!');
});

// Main Message Listener
client.on('message', async (msg) => {
    // Sirf incoming messages ko handle karna hai (status/groups ko ignore karne ke liye)
    if (msg.fromMe || msg.isGroup) return;

    try {
        console.log(`📩 Message received from ${msg.from}: ${msg.body}`);

        // Python Flask API ko message forward karna
        const response = await axios.post(PYTHON_BACKEND_URL, {
            message: msg.body
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const apiData = response.data;

        // 🎯 VOICE NOTE LOGIC: Agar backend se voice note instruction aaye
        if (apiData.status === "success" && apiData.send_type === "voice_only") {
            console.log(`🔊 Sending Pre-recorded Voice Note from: ${apiData.audio_url}`);
            
            // sendPtt function se direct Green Mic wala real voice note jaata hai
            await client.sendPtt(msg.from, apiData.audio_url);
        } 
        // 🎯 TEXT LOGIC: Agar normal AI reply aaye
        else if (apiData.status === "success" && apiData.reply) {
            console.log(`💬 Sending Text Reply: ${apiData.reply}`);
            await client.sendMessage(msg.from, apiData.reply);
        }

    } catch (error) {
        console.error("❌ Bridge Error while routing message:", error.message);
    }
});

// Handle Disconnection
client.on('disconnected', (reason) => {
    console.log('🔴 Client was logged out from WhatsApp:', reason);
    client.initialize();
});

// Start the Client
client.initialize();
