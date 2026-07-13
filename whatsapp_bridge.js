const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const express = require('express');

// Express App for Render Port Binding
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('WhatsApp Bridge Service is Running!');
});

app.listen(PORT, () => {
    console.log(`🚀 Web server listening on port ${PORT}`);
});

// Live Render Python Server URL
const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'https://whatsapp-ai-bot-l8kf.onrender.com/process-message';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('whatsapp_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Windows", "Chrome", "120.0.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n==================================================");
            console.log("📲 SCAN THIS CLEAN QR CODE FROM YOUR WHATSAPP:");
            console.log("==================================================\n");
            // { small: true } use karke compact & sharp QR code banega
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('\n==================================================');
            console.log('✅ WHATSAPP CONNECTED & READY FOR MESSAGES!');
            console.log('==================================================\n');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            const msg = messages[0];
            if (!msg.key.fromMe) {
                const sender = msg.key.remoteJid;
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

                if (!text) return;

                const lowerText = text.toLowerCase();
                console.log(`📩 New Message from ${sender}: "${text}"`);

                try {
                    const res = await axios.post(PYTHON_SERVER_URL, {
                        from: sender,
                        message: text
                    });

                    const data = res.data;

                    if (data.reply_text && data.reply_text.trim() !== "") {
                        await delay(2000);
                        await sock.sendMessage(sender, { text: data.reply_text });
                        console.log(`🤖 AI Reply Sent to ${sender}`);
                    }

                    if (lowerText.includes('pdf') || lowerText.includes('brochure') || lowerText.includes('syllabus')) {
                        await delay(1000);
                        const pdfPath = path.join(__dirname, 'files', 'brochure.pdf');
                        if (fs.existsSync(pdfPath)) {
                            await sock.sendMessage(sender, {
                                document: fs.readFileSync(pdfPath),
                                mimetype: 'application/pdf',
                                fileName: 'Course_Brochure.pdf'
                            });
                        }
                    }

                    if (lowerText.includes('demo') || lowerText.includes('video') || lowerText.includes('sample')) {
                        await delay(1000);
                        const videoPath = path.join(__dirname, 'files', 'demo.mp4');
                        if (fs.existsSync(videoPath)) {
                            await sock.sendMessage(sender, {
                                video: fs.readFileSync(videoPath),
                                caption: '🎬 Demo Class Video',
                                mimetype: 'video/mp4'
                            });
                        }
                    }

                    if (lowerText.includes('photo') || lowerText.includes('banner') || lowerText.includes('poster') || lowerText.includes('image')) {
                        await delay(1000);
                        const imgPath = path.join(__dirname, 'files', 'banner.jpg');
                        if (fs.existsSync(imgPath)) {
                            await sock.sendMessage(sender, {
                                image: fs.readFileSync(imgPath),
                                caption: '🖼️ Course Offer & Details'
                            });
                        }
                    }

                } catch (err) {
                    console.error("❌ Error processing request:", err.message);
                }
            }
        }
    });
}

connectToWhatsApp();
