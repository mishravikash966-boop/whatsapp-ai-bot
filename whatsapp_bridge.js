const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');

// ⚠️ APNA WHATSAPP NUMBER YAHAN BINA HASH/PLUS KE DAALEIN (E.g., "91XXXXXXXXXX")
const MY_PHONE_NUMBER = "919458708924"; 
const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        // ⚡ KEEP ALIVE SETTINGS: Server ko disconnected state me jaane se rokega
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        emitOwnEvents: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`🔴 Connection closed (Reason: ${statusCode}). Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) {
                // Thoda delay dekar reconnect karenge taaki server lock na kare
                setTimeout(() => { startBot(); }, 5000);
            }
        } else if (connection === 'open') {
            console.log('🟢 WhatsApp Bridge (Baileys Engine) Active & Authenticated!');
        }

        // Jab tak credentials register nahi hote, direct pairing code generate hoga
        if (!sock.authState.creds.registered && connection !== 'open' && connection !== 'close') {
            try {
                console.log(`⏳ Requesting 8-Digit OTP Code for ${MY_PHONE_NUMBER}...`);
                // 3 seconds ke safe timeout ke baad direct call
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode(MY_PHONE_NUMBER);
                        console.log("\n==========================================");
                        console.log(`🔑 APKA WHATSAPP OTP CODE HAI: ${code}`);
                        console.log("==========================================\n");
                    } catch (err) {
                        console.log("⚠️ OTP Request Error inside trigger:", err.message);
                    }
                }, 3000);
            } catch (err) {
                console.log("⚠️ Parent OTP Trigger Error:", err.message);
            }
        }
    });

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
                if (apiData.reply) {
                    await sock.sendMessage(from, { text: apiData.reply });
                }

                if (apiData.send_type === "document" && apiData.file_url) {
                    console.log(`🎵 Injecting Native Voice Note: ${apiData.file_url}`);
                    await sock.sendMessage(from, { 
                        audio: { url: apiData.file_url }, 
                        mimetype: 'audio/mp4', 
                        ptt: true 
                    });
                    console.log("✅ Voice note dispatched!");
                }
            }
        } catch (error) {
            console.error("❌ Routing Error:", error.message);
        }
    });
}

startBot();
