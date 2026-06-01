const targetGroupName = "হিলফুল ফুজুল"; 

const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;
let qrCodeImage = ''; 
let connectionStatus = 'বট রানিং আছে...'; 

app.get('/', (req, res) => {
    if (connectionStatus === 'connected') {
        res.send('<h1 style="text-align: center; color: green; margin-top: 50px;">🎉 আলহামদুলিল্লাহ! আপনার বট এখন সম্পূর্ণ প্রস্তুত এবং রানিং!</h1>');
    } else if (qrCodeImage) {
        res.send(`<div style="text-align: center; margin-top: 50px;"><img src="${qrCodeImage}" alt="QR"><p>${connectionStatus}</p></div>`);
    } else {
        res.send(`<h2 style="text-align:center; margin-top:50px;">${connectionStatus}</h2>`);
    }
});
app.listen(port, () => console.log(`ওয়েব সার্ভার ${port} পোর্টে চলছে...`));

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('session_web_qr');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            try {
                qrCodeImage = await QRCode.toDataURL(qr);
                connectionStatus = 'QR কোড রেডি! স্ক্যান করুন...';
            } catch (err) {}
        }
        if(connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if(reason === 401) qrCodeImage = ''; 
            setTimeout(connectToWhatsApp, 5000);
        } else if(connection === 'open') {
            connectionStatus = 'connected';
            qrCodeImage = ''; 
            console.log('\n🎉 আলহামদুলিল্লাহ! বট রানিং!\n');
        }
    });

    // 🔴 নতুন রুলস: বটকে গ্রুপ চেনানোর জন্য একটি কমান্ড অ্যাড করা হলো
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if(type !== 'notify') return;
        const msg = messages[0];
        if(!msg.message) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        // আপনি !test লিখলে বট বুঝতে পারবে সে কোন গ্রুপে আছে
        if(text === '!test') {
            await sock.sendMessage(msg.key.remoteJid, { text: '✅ আলহামদুলিল্লাহ! আপনার বট এই গ্রুপে ১০০% কাজ করছে এবং গ্রুপটিকে চিনে নিয়েছে!' }, { quoted: msg });
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            try {
                const groupMeta = await sock.groupMetadata(update.id);
                
                if (groupMeta.subject.includes(targetGroupName)) {
                    for (let participant of update.participants) {
                        if (participant === sock.user.jid) continue;

                        const userNumber = participant.split('@')[0];
                        const welcomeMessage = `স্বাগতম @${userNumber}! 🎉\n\nআমাদের গ্রুপে আপনাকে পেয়ে আমরা আনন্দিত।\n\n📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন।\n\nধন্যবাদ!`;
                        
                        await sock.sendMessage(update.id, { text: welcomeMessage, mentions: [participant] });
                    }
                }
            } catch (err) {
                console.error('মেসেজ পাঠাতে সমস্যা:', err);
            }
        }
    });
}
connectToWhatsApp();
