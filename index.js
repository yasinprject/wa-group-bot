const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

// Render-এর জন্য ডামি ওয়েব সার্ভার
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('আলহামদুলিল্লাহ, আপনার হোয়াটসঅ্যাপ বট সচল আছে!'));
app.listen(port, () => console.log(`ওয়েব সার্ভার ${port} পোর্টে চলছে...`));

async function connectToWhatsApp () {
    // সেশন সেভ রাখার ব্যবস্থা (যাতে বারবার স্ক্যান করতে না হয়)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // স্বয়ংক্রিয়ভাবে টার্মিনালে QR কোড দেখাবে
        logger: pino({ level: 'silent' }) // অতিরিক্ত হাবিজাবি লগ বন্ধ রাখার জন্য
    });

    // ক্রেডেনশিয়াল আপডেট হলে সেভ করা
    sock.ev.on('creds.update', saveCreds);

    // কানেকশন আপডেট দেখা
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            console.log('কানেকশন বিচ্ছিন্ন হয়েছে, আবার যুক্ত হচ্ছে...');
            connectToWhatsApp();
        } else if(connection === 'open') {
            console.log('🎉 আলহামদুলিল্লাহ! আপনার বট এখন সম্পূর্ণ প্রস্তুত এবং রানিং!');
        }
    });

    // কেউ গ্রুপে জয়েন করলে যা ঘটবে
    sock.ev.on('group-participants.update', async (update) => {
        // যদি কেউ গ্রুপে যুক্ত হয় (action === 'add')
        if (update.action === 'add') {
            for (let participant of update.participants) {
                // নম্বর থেকে @s.whatsapp.net বাদ দিয়ে শুধু নম্বর নেওয়া
                const userNumber = participant.split('@')[0];
                
                const welcomeMessage = `স্বাগতম @${userNumber}! 🎉\n\nআমাদের গ্রুপে আপনাকে পেয়ে আমরা আনন্দিত।\n\n📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন।\n\nধন্যবাদ!`;
                
                try {
                    await sock.sendMessage(update.id, { 
                        text: welcomeMessage, 
                        mentions: [participant] 
                    });
                    console.log(`নতুন মেম্বারকে ওয়েলকাম মেসেজ পাঠানো হয়েছে!`);
                } catch (err) {
                    console.error('মেসেজ পাঠাতে এরর:', err);
                }
            }
        }
    });
}

// বট চালু করা
connectToWhatsApp();
