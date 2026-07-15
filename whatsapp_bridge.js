const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js'); // <-- MessageMedia add kiya
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppetShowBrowser: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🟢 WhatsApp Bridge Ready!'));

client.on('message', async (msg) => {
    if (msg.fromMe || msg.isGroup) return;

    try {
        const response = await axios.post(PYTHON_BACKEND_URL, { message: msg.body });
        const apiData = response.data;

        if (apiData.status === "success" && apiData.send_type === "voice_only") {
            console.log(`🔊 Fetching Audio Media from: ${apiData.audio_url}`);
            
            // URL se media object convert karna zaroori hai
            const media = await MessageMedia.fromUrl(apiData.audio_url);
            
            // sendPtt me media object pass hoga, direct string URL nahi
            await client.sendPtt(msg.from, media);
            console.log("✅ Voice note delivered successfully!");
        } 
        else if (apiData.status === "success" && apiData.reply) {
            await client.sendMessage(msg.from, apiData.reply);
        }
    } catch (error) {
        console.error("❌ Bridge Routing Error:", error.message);
    }
});

client.initialize();
