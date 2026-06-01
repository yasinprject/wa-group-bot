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

let targetGroupId = '';
if (fs.existsSync('group_id.txt')) {
    targetGroupId = fs.readFileSync('group_id.txt', 'utf8');
}

const welcomedUsers = new Set();

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

    const sendWelcomeMessage = (groupId, participant) => {
        // 🔴 ক্র্যাশ এড়ানোর জন্য পাওয়ারফুল সেফটি চেক
        if (!participant || typeof participant !== 'string') return;
        
        if (welcomedUsers.has(participant)) return;
        welcomedUsers.add(participant);
        setTimeout(() => welcomedUsers.delete(participant), 60000); 

        // নিজের নম্বর চেক (সেফটি সহ)
        const myNumber = sock.user?.id?.split(':')[0] || '';
        if (myNumber && participant.includes(myNumber)) return;

        const userNumber = participant.split('@')[0];
        const welcomeMessage = `স্বাগতম @${userNumber}! 🎉\n\nআমাদের গ্রুপে আপনাকে পেয়ে আমরা আনন্দিত।\n\n📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন।\n\nধন্যবাদ!`;

        setTimeout(async () => {
            try { await sock.sendMessage(groupId, { text: welcomeMessage, mentions: [participant] }); } catch (err) {}
        }, 2500);
    };

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if(type !== 'notify') return;
        const msg = messages[0];

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        if(text === '!set') {
            targetGroupId = msg.key.remoteJid;
            fs.writeFileSync('group_id.txt', targetGroupId);
            await sock.sendMessage(targetGroupId, { text: '✅ আলহামদুলিল্লাহ! এই গ্রুপটিকে ওয়েলকাম মেসেজের জন্য সফলভাবে লক (Lock) করা হয়েছে।' }, { quoted: msg });
            return;
        }

        if (msg.messageStubType === 27 || msg.messageStubType === 32) {
            const groupId = msg.key.remoteJid;
            if (targetGroupId && groupId !== targetGroupId) return;

            const participants = msg.messageStubParameters || [];
            for (let participant of participants) {
                sendWelcomeMessage(groupId, participant);
            }
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add' || update.action === 'invite') {
            const groupId = update.id;
            if (targetGroupId && groupId !== targetGroupId) return;

            const participants = update.participants || [];
            for (let participant of participants) {
                sendWelcomeMessage(groupId, participant);
            }
        }
    });
}
connectToWhatsApp();
