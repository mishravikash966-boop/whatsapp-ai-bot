const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

// 🎯 Render Port Binding Fix Layer
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WhatsApp Bridge is Alive!'));
app.listen(PORT, () => console.log(`🚀 Dummy Port Server listening on port ${PORT}`));

// ⚠️ APNA WHATSAPP NUMBER YAHAN BINA HASH/PLUS KE DAALEIN
const MY_PHONE_NUMBER = "919458708924"; 
const PYTHON_BACKEND_URL = "https://whatsapp-ai-bot-l8kf.onrender.com/process-message";

// Local memory me file download karne ka function
async function downloadAudio(url, filepath) {
    const writer = fs.createWriteStream(filepath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 15000
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => { startBot(); }, 5000);
            }
        } else if (connection === 'open') {
            console.log('🟢 WhatsApp Bridge Active & Authenticated!');
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
                    console.log(`🎵 Downloading audio file from: ${apiData.file_url}`);
                    const localPath = path.join(__dirname, 'temp_voice.mp3');
                    
                    try {
                        await downloadAudio(apiData.file_url, localPath);
                        console.log("✅ Audio successfully downloaded to local buffer. Now dispatching...");

                        await sock.sendMessage(from, { 
                            audio: fs.readFileSync(localPath), 
                            mimetype: 'audio/mp4', 
                            ptt: true 
                        });

                        console.log("✅ Audio sent successfully and ready to play!");

                        if (fs.existsSync(localPath)) {
                            fs.unlinkSync(localPath);
                        }
                    } catch (downloadErr) {
                        console.error("❌ Audio download or sending failed:", downloadErr.message);
                    }
                }
            }
        } catch (error) {
            console.error("❌ Connection/Routing Error with Python Backend:", error.message);
        }
    });
}

startBot();
