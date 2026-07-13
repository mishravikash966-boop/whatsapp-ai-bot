const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

// Aapka Live Render Python Server URL
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
            console.log("📲 SCAN THIS HIGH-RES QR CODE FROM YOUR WHATSAPP:");
            console.log("==================================================\n");
            // small: false se QR Code bada aur clean render hoga
            qrcode.generate(qr, { small: false });
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
                    // Send message to Python AI Server on Render
                    const res = await axios.post(PYTHON_SERVER_URL, {
                        from: sender,
                        message: text
                    });

                    const data = res.data;

                    // AI Reply
                    if (data.reply_text && data.reply_text.trim() !== "") {
                        await delay(2000); // 2 sec natural delay
                        await sock.sendMessage(sender, { text: data.reply_text });
                        console.log(`🤖 AI Reply Sent to ${sender}`);
                    }

                    // Keyword Triggers for Media
                    // PDF Check
                    if (lowerText.includes('pdf') || lowerText.includes('brochure') || lowerText.includes('syllabus')) {
                        await delay(1000);
                        const pdfPath = path.join(__dirname, 'files', 'brochure.pdf');
                        if (fs.existsSync(pdfPath)) {
                            await sock.sendMessage(sender, {
                                document: fs.readFileSync(pdfPath),
                                mimetype: 'application/pdf',
                                fileName: 'Course_Brochure.pdf'
                            });
                            console.log("📄 PDF Sent Successfully!");
                        }
                    }

                    // Video Check
                    if (lowerText.includes('demo') || lowerText.includes('video') || lowerText.includes('sample')) {
                        await delay(1000);
                        const videoPath = path.join(__dirname, 'files', 'demo.mp4');
                        if (fs.existsSync(videoPath)) {
                            await sock.sendMessage(sender, {
                                video: fs.readFileSync(videoPath),
                                caption: '🎬 Demo Class Video',
                                mimetype: 'video/mp4'
                            });
                            console.log("🎬 Video Sent Successfully!");
                        }
                    }

                    // Image Check
                    if (lowerText.includes('photo') || lowerText.includes('banner') || lowerText.includes('poster') || lowerText.includes('image')) {
                        await delay(1000);
                        const imgPath = path.join(__dirname, 'files', 'banner.jpg');
                        if (fs.existsSync(imgPath)) {
                            await sock.sendMessage(sender, {
                                image: fs.readFileSync(imgPath),
                                caption: '🖼️ Course Offer & Details'
                            });
                            console.log("🖼️ Image Sent Successfully!");
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
