const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Initialize WhatsApp Web Client Configuration
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

// Python Webhook Endpoint
const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

// Display QR Code terminal configurations
client.on('qr', (qr) => {
    console.log('🔄 Scan this QR Code to connect your WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Connection Ready Hook
client.on('ready', () => {
    console.log('🟢 WhatsApp Bridge is fully authenticated and ready!');
});

// Incoming Message Orchestrator
client.on('message', async (msg) => {
    // Ignore group chats and self-triggered loops
    if (msg.fromMe || msg.isGroup) return;

    try {
        console.log(`📩 Message received from ${msg.from}: ${msg.body}`);

        // Forward payload data to Python Webhook Server
        const response = await axios.post(PYTHON_BACKEND_URL, {
            message: msg.body
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const apiData = response.data;

        // 🎯 STRUCTURE 1: DYNAMIC AUDIO DELIVERY BYPASS (sendAudio: true)
        if (apiData.status === "success" && apiData.send_type === "voice_only") {
            console.log(`🔊 Fetching Audio Asset Link from: ${apiData.audio_url}`);
            
            // Render cloud URL se media chunk format create karein
            const media = await MessageMedia.fromUrl(apiData.audio_url);
            
            // Server-safe deployment parameter trigger
            await client.sendMessage(msg.from, media, { 
                sendAudio: true 
            });
            
            console.log("✅ Audio asset injected and delivered successfully!");
        } 
        
        // 🎯 STRUCTURE 2: STANDARD AI GENAI TEXT DELIVERY TIER
        else if (apiData.status === "success" && apiData.reply) {
            console.log(`💬 Sending Text Reply: ${apiData.reply}`);
            await client.sendMessage(msg.from, apiData.reply);
        }

    } catch (error) {
        console.error("❌ Bridge Routing Exception Layer:", error.message);
    }
});

// Disconnection Handling
client.on('disconnected', (reason) => {
    console.log('🔴 Client was logged out from WhatsApp:', reason);
    client.initialize();
});

// Bootstrapper initialization
client.initialize();
