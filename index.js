const { default: makeWASocket, useMultiFileAuthState, Browsers, WAMessageStubType } = require('@whiskeysockets/baileys');
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

    // 🔴 ১০০% কার্যকরী পদ্ধতি: চ্যাটের সিস্টেম মেসেজ (StubType) রিড করা
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if(type !== 'notify') return;
        const msg = messages[0];
        
        // ১. !set কমান্ডের কাজ
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        if(text === '!set') {
            targetGroupId = msg.key.remoteJid;
            fs.writeFileSync('group_id.txt', targetGroupId);
            await sock.sendMessage(targetGroupId, { text: '✅ আলহামদুলিল্লাহ! এই গ্রুপটিকে ওয়েলকাম মেসেজের জন্য সফলভাবে লক (Lock) করা হয়েছে।' }, { quoted: msg });
            return;
        }

        // ২. গ্রুপে কেউ জয়েন করলে বা অ্যাড করলে (System Message Catch করা)
        // 27 মানে হলো GROUP_PARTICIPANT_ADD (কেউ কাউকে অ্যাড করেছে বা লিঙ্কে জয়েন করেছে)
        if (msg.messageStubType === 27 || msg.messageStubType === WAMessageStubType.GROUP_PARTICIPANT_ADD) {
            const groupId = msg.key.remoteJid;
            
            // লক করা গ্রুপ ছাড়া অন্য গ্রুপ হলে মেসেজ দিবে না
            if (targetGroupId && groupId !== targetGroupId) return;

            // যারা জয়েন করেছে তাদের নম্বরের লিস্ট
            const participants = msg.messageStubParameters || [];
            
            for (let participant of participants) {
                // বট নিজেকে নিজে যেন ওয়েলকাম না দেয়
                const myNumber = sock.user.id.split(':')[0];
                if (participant.includes(myNumber)) continue;

                const userNumber = participant.split('@')[0];
                const welcomeMessage = `স্বাগতম @${userNumber}! 🎉\n\nআমাদের গ্রুপে আপনাকে পেয়ে আমরা আনন্দিত।\n\n📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন।\n\nধন্যবাদ!`;
                
                // ২ সেকেন্ড অপেক্ষা করে মেসেজ পাঠানো
                setTimeout(async () => {
                    try {
                        await sock.sendMessage(groupId, { text: welcomeMessage, mentions: [participant] });
                    } catch (err) {
                        console.error('মেসেজ পাঠাতে সমস্যা:', err);
                    }
                }, 2000);
            }
        }
    });
}
connectToWhatsApp();
