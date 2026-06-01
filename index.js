const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const QRCode = require('qrcode'); // ওয়েবসাইটে QR কোড দেখানোর লাইব্রেরি

const app = express();
const port = process.env.PORT || 3000;

let qrCodeImage = ''; // QR কোডের ছবি এখানে সেভ হবে
let connectionStatus = 'বট স্টার্ট হচ্ছে, একটু অপেক্ষা করুন...'; 

// Render-এর ওয়েবসাইটের পেজ ডিজাইন
app.get('/', (req, res) => {
    if (connectionStatus === 'connected') {
        res.send('<h1 style="text-align: center; color: green; margin-top: 50px;">🎉 আলহামদুলিল্লাহ! আপনার বট এখন সম্পূর্ণ প্রস্তুত এবং রানিং!</h1>');
    } else if (qrCodeImage) {
        res.send(`
            <div style="text-align: center; margin-top: 50px; font-family: Arial;">
                <h2>আপনার হোয়াটসঅ্যাপ দিয়ে নিচের QR কোডটি স্ক্যান করুন</h2>
                <img src="${qrCodeImage}" alt="QR Code" style="width: 300px; height: 300px; border: 2px solid black; border-radius: 10px; padding: 10px;">
                <p style="color: blue; font-weight: bold;">স্ট্যাটাস: ${connectionStatus}</p>
                <p><em>(পেজটি রিফ্রেশ করুন যদি কোড না আসে)</em></p>
            </div>
        `);
    } else {
        res.send(`<h2 style="text-align:center; margin-top:50px;">${connectionStatus}</h2><p style="text-align:center;">পেজটি একটু পর পর রিফ্রেশ করুন...</p>`);
    }
});

app.listen(port, () => console.log(`ওয়েব সার্ভার ${port} পোর্টে চলছে...`));

async function connectToWhatsApp () {
    // নতুন সেশন ফোল্ডার
    const { state, saveCreds } = await useMultiFileAuthState('session_web_qr');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false // টার্মিনালের হাবিজাবি QR বন্ধ
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // সার্ভার থেকে QR কোড আসলে সেটাকে ছবিতে কনভার্ট করে ওয়েবসাইটে পাঠানো
        if (qr) {
            connectionStatus = 'QR কোড রেডি! স্ক্যান করুন...';
            try {
                qrCodeImage = await QRCode.toDataURL(qr);
                console.log('✅ নতুন QR কোড ওয়েবসাইটে আপডেট করা হয়েছে!');
            } catch (err) {
                console.error('QR জেনারেট করতে সমস্যা:', err);
            }
        }

        if(connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            connectionStatus = 'কানেকশন রিস্টার্ট হচ্ছে...';
            console.log(`কানেকশন বিচ্ছিন্ন (Code: ${reason}).`);
            if(reason === 401) qrCodeImage = ''; // লগআউট হলে কোড মুছে ফেলা
            setTimeout(connectToWhatsApp, 5000);
        } else if(connection === 'open') {
            connectionStatus = 'connected';
            qrCodeImage = ''; // কানেক্ট হলে ছবি গায়েব
            console.log('\n🎉 আলহামদুলিল্লাহ! আপনার বট রানিং!\n');
        }
    });

    // কেউ গ্রুপে জয়েন করলে মেসেজ দেওয়ার কোড
    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            for (let participant of update.participants) {
                const userNumber = participant.split('@')[0];
                const welcomeMessage = `স্বাগতম @${userNumber}! 🎉\n\nআমাদের গ্রুপে আপনাকে পেয়ে আমরা আনন্দিত।\n\n📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন।\n\nধন্যবাদ!`;
                try {
                    await sock.sendMessage(update.id, { text: welcomeMessage, mentions: [participant] });
                } catch (err) {}
            }
        }
    });
}

connectToWhatsApp();
