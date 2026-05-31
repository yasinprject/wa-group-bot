// 👇 আপনার বটের নম্বরটি এখানে দিন (880 সহ, কোনো + বা স্পেস দেবেন না)
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
    // 🔴 ম্যাজিক ট্রিক: ফোল্ডারের নাম পরিবর্তন করে 'fresh_session_1' দেওয়া হলো
    // এতে আগের সব জ্যাম হওয়া ক্যাশ ইগনোর করে একদম ফ্রেশভাবে শুরু হবে!
    const { state, saveCreds } = await useMultiFileAuthState('fresh_session_1');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['WA Bot', 'Chrome', '1.0.0'], 
        printQRInTerminal: false
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(botNumber);
                // কোডটি সুন্দর করে দেখানোর জন্য মাঝে হাইফেন (-) দেওয়া হলো
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log('\n=============================================');
                console.log(`✅ আপনার পেয়ারিং কোড (Pairing Code): ${code}`);
                console.log('=============================================\n');
            } catch (error) {
                console.log('কোড তৈরিতে সমস্যা:', error.message);
            }
        }, 4000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if(connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`কানেকশন বিচ্ছিন্ন হয়েছে (Reason: ${reason}). আবার যুক্ত হচ্ছে...`);
            // 401 মানে লগআউট, লগআউট হলে আর লুপ করবে না
            if(reason !== 401) {
                setTimeout(connectToWhatsApp, 5000);
            }
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
                } catch (err) {}
            }
        }
    });
}

connectToWhatsApp();
