const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('WhatsApp Bridge Service is Active!');
});

app.listen(PORT, () => {
    console.log(`🚀 Web server listening on port ${PORT}`);
});

const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'https://whatsapp-ai-bot-l8kf.onrender.com/process-message';
const PHONE_NUMBER = process.env.PHONE_NUMBER || '918528199808'; 
const ADMIN_NUMBER = process.env.ADMIN_NUMBER || ''; 

const delay = ms => new Promise(res => setTimeout(res, ms));

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('whatsapp_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Mac OS", "Chrome", "121.0.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const cleanNumber = PHONE_NUMBER.replace(/[^0-9]/g, '');
                if (!cleanNumber || cleanNumber.length < 10 || cleanNumber.includes('X')) {
                    console.log("⚠️ PLEASE SET A VALID PHONE_NUMBER!");
                    return;
                }
                
                let code = await sock.requestPairingCode(cleanNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\n==================================================");
                console.log(`🔑 NUMERIC PAIRING CODE (OTP): ${code}`);
                console.log("==================================================\n");
            } catch (err) {
                console.error("❌ Pairing Code error:", err.message);
            }
        }, 4000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log("❌ Logged Out. Cleaning session...");
                if (fs.existsSync('whatsapp_session')) {
                    fs.rmSync('whatsapp_session', { recursive: true, force: true });
                }
                connectToWhatsApp();
            }
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
                // Remote JID Handle (Works for both LID and Normal numbers)
                const sender = msg.key.remoteJid;
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

                if (!text) return;

                if (ADMIN_NUMBER) {
                    const cleanAdmin = ADMIN_NUMBER.replace(/[^0-9]/g, '');
                    if (sender.includes(cleanAdmin)) return;
                }

                const lowerText = text.toLowerCase().trim();
                console.log(`📩 New Message from ${sender}: "${text}"`);

                try {
                    // Python AI Server Request
                    const res = await axios.post(PYTHON_SERVER_URL, {
                        from: sender,
                        message: text
                    });

                    const data = res.data;

                    if (data && data.reply_text && data.reply_text.trim() !== "") {
                        await delay(1000);
                        await sock.sendMessage(sender, { text: data.reply_text });
                        console.log(`🤖 AI Reply Sent to ${sender}`);

                        // Admin Audit Forwarding
                        if (ADMIN_NUMBER) {
                            const cleanAdmin = ADMIN_NUMBER.replace(/[^0-9]/g, '');
                            const adminJid = `${cleanAdmin}@s.whatsapp.net`;
                            const fullAuditMessage = `🔔 *LIVE CHAT AUDIT LOG*\n\n👤 *Customer:* ${sender}\n📥 *Sent:* "${text}"\n🤖 *Bot:* "${data.reply_text}"`;
                            await delay(1000);
                            await sock.sendMessage(adminJid, { text: fullAuditMessage });
                        }
                    }

                    // 📄 PDF Auto-Send Fix
                    if (lowerText.includes('pdf') || lowerText.includes('brochure') || lowerText.includes('syllabus')) {
                        await delay(1500);
                        const pdfPath = path.join(__dirname, 'files', 'brochure.pdf');
                        if (fs.existsSync(pdfPath)) {
                            await sock.sendMessage(sender, {
                                document: fs.readFileSync(pdfPath),
                                mimetype: 'application/pdf',
                                fileName: 'Course_Brochure.pdf'
                            }, { quoted: msg });
                            console.log(`📄 PDF Sent Successfully to ${sender}`);
                        }
                    }

                    // 🎬 Video Auto-Send Fix
                    if (lowerText.includes('demo') || lowerText.includes('video') || lowerText.includes('sample')) {
                        await delay(1500);
                        const videoPath = path.join(__dirname, 'files', 'demo.mp4');
                        if (fs.existsSync(videoPath)) {
                            await sock.sendMessage(sender, {
                                video: fs.readFileSync(videoPath),
                                caption: '🎬 Demo Class Video',
                                mimetype: 'video/mp4'
                            }, { quoted: msg });
                            console.log(`🎬 Video Sent Successfully to ${sender}`);
                        }
                    }

                    // 🖼️ Poster/Photo Auto-Send Fix
                    if (lowerText.includes('photo') || lowerText.includes('banner') || lowerText.includes('poster') || lowerText.includes('image')) {
                        await delay(1500);
                        const imgPath = path.join(__dirname, 'files', 'banner.jpg');
                        if (fs.existsSync(imgPath)) {
                            await sock.sendMessage(sender, {
                                image: fs.readFileSync(imgPath),
                                caption: '🖼️ Course Offer & Details'
                            }, { quoted: msg });
                            console.log(`🖼️ Image Sent Successfully to ${sender}`);
                        }
                    }

                } catch (err) {
                    console.error(`❌ Error processing request:`, err.message);
                }
            }
        }
    });
}

connectToWhatsApp();
