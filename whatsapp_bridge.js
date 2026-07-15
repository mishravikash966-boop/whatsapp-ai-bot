const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppetShowBrowser: false,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
    ]
});

const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🟢 WhatsApp Bridge Ready & Stable!'));

client.on('message', async (msg) => {
    if (msg.fromMe || msg.isGroup) return;

    try {
        console.log(`📩 Incoming: ${msg.body}`);
        const response = await axios.post(PYTHON_BACKEND_URL, { message: msg.body });
        const apiData = response.data;

        if (apiData.status === "success" && apiData.send_type === "voice_only") {
            console.log(`🔊 Voice request triggered...`);

            // 🎯 LOCAL FILE HANDLING BYPASS
            // Agar aapki audio file local folder me hai toh use direct buffer se read karenge
            const localAudioPath = path.join(__dirname, 'static_audio', 'sales_demo.mp3');
            
            let media;
            if (fs.existsSync(localAudioPath)) {
                // Agar file local repository me hi exist karti hai
                media = MessageMedia.fromFilePath(localAudioPath);
                console.log("📂 Reading audio from local directory path.");
            } else {
                // Fallback: Agar local nahi mili toh cloud URL se buffer base data uthayenge
                const audioBuffer = await axios.get(apiData.audio_url, { responseType: 'arraybuffer' });
                const base64Audio = Buffer.from(audioBuffer.data, 'binary').toString('base64');
                media = new MessageMedia('audio/mp3', base64Audio, 'sales_demo.mp3');
                console.log("🌐 Downloaded via binary arraybuffer fallback.");
            }

            // Target send architecture
            await client.sendMessage(msg.from, media, { 
                sendAudio: true 
            });
            
            console.log("✅ Voice note bypassed and delivered!");
        } 
        else if (apiData.status === "success" && apiData.reply) {
            await client.sendMessage(msg.from, apiData.reply);
        }
    } catch (error) {
        console.error("❌ Bridge Core Error:", error.message);
    }
});

client.initialize();
