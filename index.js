// আপনার নির্দিষ্ট গ্রুপের নাম
const targetGroupName = "হিলফুল ফুজুল"; 

const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');

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

// 🔴 যাদের ওয়েলকাম দেওয়া হয়েছে, তাদের লিস্ট সেভ রাখার মেমোরি
let welcomedUsers = [];
if (fs.existsSync('welcomed.json')) {
    welcomedUsers = JSON.parse(fs.readFileSync('welcomed.json'));
}

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
            try { qrCodeImage = await QRCode.toDataURL(qr); connectionStatus = 'QR কোড রেডি! স্ক্যান করুন...'; } catch (err) {}
        }
        if(connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if(reason === 401) qrCodeImage = ''; 
            setTimeout(connectToWhatsApp, 5000);
        } else if(connection === 'open') {
            connectionStatus = 'connected'; qrCodeImage = ''; 
            console.log('\n🎉 আলহামদুলিল্লাহ! বট রানিং!\n');
        }
    });

    // 🔴 ম্যাজিক লজিক: কেউ মেসেজ দিলে তাকে ধরে ওয়েলকাম দেওয়া
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if(type !== 'notify') return;
        const msg = messages[0];

        // যদি মেসেজ না থাকে বা বট নিজে মেসেজ দেয়, তবে ইগনোর করবে
        if(!msg.message || msg.key.fromMe) return;

        // চেক করা হচ্ছে মেসেজটি গ্রুপ থেকে এসেছে কি না
        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        if(!isGroup) return;

        try {
            const groupId = msg.key.remoteJid;
            const groupMeta = await sock.groupMetadata(groupId);
            
            // চেক করা হচ্ছে এটা আপনার "হিলফুল ফুজুল" গ্রুপ কি না
            if (groupMeta.subject.includes(targetGroupName)) {
                
                const sender = msg.key.participant; // যে মেসেজ দিয়েছে তার নম্বর

                // চেক করা হচ্ছে তাকে আগে ওয়েলকাম দেওয়া হয়েছে কি না
                if (!welcomedUsers.includes(sender)) {
                    
                    const userNumber = sender.split('@')[0];
                    const welcomeMessage = `স্বাগতম @${userNumber}! 🎉\n\nআমাদের গ্রুপে আপনাকে পেয়ে আমরা আনন্দিত।\n\n📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন।\n\nধন্যবাদ!`;
                    
                    // মেসেজটি সেন্ড করা হচ্ছে (তাকে মেনশন করে)
                    await sock.sendMessage(groupId, { text: welcomeMessage, mentions: [sender] });

                    // তার নম্বরটি মেমোরিতে সেভ করে রাখা হচ্ছে, যাতে পরে মেসেজ দিলে আর ওয়েলকাম না যায়
                    welcomedUsers.push(sender);
                    fs.writeFileSync('welcomed.json', JSON.stringify(welcomedUsers));
                }
            }
        } catch (err) {
            console.error('মেসেজ প্রসেস করতে এরর:', err);
        }
    });
}
connectToWhatsApp();
