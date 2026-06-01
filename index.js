// 👇 আপনার গ্রুপের মূল নামটি এখানে দিন
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
        printQRInTerminal: false,
        syncFullHistory: false // দ্রুত কানেক্ট হওয়ার জন্য
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

    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            try {
                const groupMeta = await sock.groupMetadata(update.id);
                
                // 🔴 ম্যাজিক ট্রিক: includes ব্যবহার করা হয়েছে, অর্থাৎ বানান হুবহু না মিললেও শব্দটা থাকলেই কাজ করবে!
                if (groupMeta.subject.includes(targetGroupName)) {
                    for (let participant of update.participants) {
                        // বট নিজেকে নিজে যেন ওয়েলকাম না দেয়
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
