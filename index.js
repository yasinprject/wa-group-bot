const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('আলহামদুলিল্লাহ, আপনার হোয়াটসঅ্যাপ বট সচল আছে!'));
app.listen(port, () => console.log(`ওয়েব সার্ভার ${port} পোর্টে চলছে...`));

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['WA Bot', 'Chrome', '1.0.0'] // এই লাইনটি কানেকশন বিচ্ছিন্ন হওয়া বন্ধ করবে
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        
        if (qr) {
            console.log('\n✅ নিচের QR কোডটি আপনার হোয়াটসঅ্যাপ দিয়ে স্ক্যান করুন:\n');
            qrcode.generate(qr, { small: true });
        }

        if(connection === 'close') {
            console.log('কানেকশন বিচ্ছিন্ন হয়েছে, আবার যুক্ত হচ্ছে...');
            // ৩ সেকেন্ড পর আবার ট্রাই করবে যাতে সার্ভার হ্যাং না হয়
            setTimeout(connectToWhatsApp, 3000); 
        } else if(connection === 'open') {
            console.log('\n🎉 আলহামদুলিল্লাহ! আপনার বট এখন সম্পূর্ণ প্রস্তুত এবং রানিং!\n');
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            for (let participant of update.participants) {
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

connectToWhatsApp();
