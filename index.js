// 👇 আপনার যেই গ্রুপে বট কাজ করবে, ঠিক সেই গ্রুপের হুবহু নাম এখানে দিন (ইমোজি থাকলে সেটাও দিবেন)
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
    // আগের সেশনটাই ব্যবহার করবে, তাই নতুন করে স্ক্যান করতে হবে না
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

    // 🔴 নির্দিষ্ট গ্রুপের জন্য ম্যাজিক লজিক
    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            try {
                // যে গ্রুপে জয়েন করেছে, তার ডেটা নেওয়া
                const groupMeta = await sock.groupMetadata(update.id);
                
                // চেক করা হচ্ছে গ্রুপের নাম আপনার দেওয়া নামের সাথে মেলে কি না
                if (groupMeta.subject === targetGroupName) {
                    for (let participant of update.participants) {
                        const userNumber = participant.split('@')[0];
                        const welcomeMessage = `স্বাগতম @${userNumber}! 🎉\n\nআমাদের গ্রুপে আপনাকে পেয়ে আমরা আনন্দিত।\n\n📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন।\n\nধন্যবাদ!`;
                        
                        await sock.sendMessage(update.id, { text: welcomeMessage, mentions: [participant] });
                    }
                } else {
                    console.log(`অন্য গ্রুপে জয়েন করেছে (${groupMeta.subject}), তাই মেসেজ দেওয়া হলো না।`);
                }
            } catch (err) {
                console.error('মেসেজ পাঠাতে সমস্যা:', err);
            }
        }
    });
}

connectToWhatsApp();
