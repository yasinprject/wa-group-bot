// 👇 আপনার বটের নম্বরটি এখানে দিন (880 সহ)
const botNumber = "8801302108957"; 

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('আলহামদুলিল্লাহ, আপনার হোয়াটসঅ্যাপ বট সচল আছে!'));
app.listen(port, () => console.log(`ওয়েব সার্ভার ${port} পোর্টে চলছে...`));

let pairingCodeRequested = false; // এটি কোড বারবার আসা বন্ধ করবে

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        printQRInTerminal: false
    });

    // মাত্র একবার কোড জেনারেট করবে
    if (!sock.authState.creds.registered && !pairingCodeRequested) {
        pairingCodeRequested = true;
        
        // সার্ভার রান হওয়ার ৫ সেকেন্ড পর কোড দেবে, যাতে আপনি রেডি হতে পারেন
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(botNumber);
                console.log('\n=============================================');
                console.log(`✅ আপনার পেয়ারিং কোড: ${code}`);
                console.log('=============================================\n');
            } catch (error) {
                console.log('কোড তৈরিতে সমস্যা:', error.message);
                pairingCodeRequested = false; // ফেইল হলে আবার ট্রাই করার সু্যোগ
            }
        }, 5000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        
        if(connection === 'close') {
            console.log('কানেকশন রিস্টার্ট হচ্ছে...');
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
                } catch (err) {}
            }
        }
    });
}

connectToWhatsApp();
