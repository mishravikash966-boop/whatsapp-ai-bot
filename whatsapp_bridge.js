const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// ⚠️ APNA WHATSAPP NUMBER YAHAN BINA HASH/PLUS KE DAALEIN (E.g., "91XXXXXXXXXX")
const MY_PHONE_NUMBER = "919458708924"; 
const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    // Bina kisi browser ke socket connection create karega (Ultra Light)
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔴 Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('🟢 WhatsApp Bridge (Baileys Engine) Active & Authenticated!');
        }

        // Agar connect nahi hai aur code chahiye toh direct OTP trigger karega
        if (!sock.authState.creds.registered && connection !== 'open') {
            setTimeout(async () => {
                try {
                    console.log(`⏳ Requesting 8-Digit OTP Code for ${MY_PHONE_NUMBER}...`);
                    let code = await sock.requestPairingCode(MY_PHONE_NUMBER);
                    console.log("\n==========================================");
                    console.log(`🔑 APKA WHATSAPP OTP CODE HAI: ${code}`);
                    console.log("==========================================\n");
                } catch (err) {
                    console.log("OTP Status Check:", err.message);
                }
            }, 6000);
        }
    });

    // Incoming messages handle karne ke liye
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!textMessage) return;
        console.log(`📩 Incoming: ${textMessage}`);

        try {
            const response = await axios.post(PYTHON_BACKEND_URL, {
                message: textMessage
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const apiData = response.data;

            if (apiData.status === "success") {
                // Pehle agar koi text reply hai toh use bhejega
                if (apiData.reply) {
                    await sock.sendMessage(from, { text: apiData.reply });
                }

                // AI AUDIO TIER: Agar audio file hai, toh direct voice note (.ptt) ki tarah jayegi bina browser loading ke
                if (apiData.send_type === "document" && apiData.file_url) {
                    console.log(`🎵 Injecting Native Voice Note from: ${apiData.file_url}`);
                    await sock.sendMessage(from, { 
                        audio: { url: apiData.file_url }, 
                        mimetype: 'audio/mp4', // WhatsApp isko direct browser me bina size heavy kiye play kar deta hai
                        ptt: true // ptt true karne se yeh standard audio file nahi, balki green voice record ban jata hai!
                    });
                    console.log("✅ Voice note dispatched successfully!");
                }
            }
        } catch (error) {
            console.error("❌ Routing Error:", error.message);
        }
    });
}

startBot();
