// 👇 আপনার যেই নম্বরটিকে বট বানাতে চান, সেটি এখানে দিন (দেশের কোড 880 সহ, কিন্তু + ছাড়া)
// যেমন: "8801712345678"
const botNumber = "8801302108957"; 

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('আলহামদুলিল্লাহ, আপনার হোয়াটসঅ্যাপ বট সচল আছে!'));
app.listen(port, () => console.log(`ওয়েব সার্ভার ${port} পোর্টে চলছে...`));

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'], // ক্লাউড সার্ভার হিসেবে লিনাক্স পরিচয় দেওয়া হলো
        printQRInTerminal: false // QR কোড পুরোপুরি বন্ধ
    });

    // পেয়ারিং কোড জেনারেট করার সিস্টেম
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(botNumber);
                console.log('\n=============================================');
                console.log(`✅ আপনার পেয়ারিং কোড (Pairing Code): ${code}`);
                console.log('আপনার হোয়াটসঅ্যাপ অ্যাপে গিয়ে "Link with phone number instead" এ ক্লিক করে এই কোডটি বসান।');
                console.log('=============================================\n');
            } catch (error) {
                console.log('পেয়ারিং কোড তৈরি করতে সমস্যা হয়েছে:', error.message);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        
        if(connection === 'close') {
            console.log('কানেকশন সাময়িকভাবে বিচ্ছিন্ন হয়েছে, আবার যুক্ত হচ্ছে...');
            setTimeout(connectToWhatsApp, 5000); 
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
                    await sock.sendMessage(update.id, { text: welcomeMessage, mentions: [participant] });
                    console.log(`নতুন মেম্বারকে ওয়েলকাম মেসেজ পাঠানো হয়েছে!`);
                } catch (err) {}
            }
        }
    });
}

connectToWhatsApp();
