// 👇 আপনার বটের নম্বরটি এখানে দিন (880 সহ, কোনো + বা স্পেস দেবেন না)
const botNumber = "88011302108957"; 

const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
app.get('/', (req, res) => res.send('আলহামদুলিল্লাহ, আপনার হোয়াটসঅ্যাপ বট সচল আছে!'));
app.listen(process.env.PORT || 3000, () => console.log(`সার্ভার চলছে...`));

async function connectToWhatsApp () {
    // আগের সব ক্যাশ ফেলে দিয়ে একদম নতুন সেশন
    const { state, saveCreds } = await useMultiFileAuthState('session_mac_desktop');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        // 🔴 ম্যাজিক ট্রিক ১: ম্যাক ডেস্কটপের ছদ্মবেশ (যাতে সন্দেহ না করে)
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false,
        // 🔴 ম্যাজিক ট্রিক ২: সিপিইউ লোড কমানো এবং কানেকশন ধরে রাখা
        syncFullHistory: false, 
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 30000 
    });

    if (!sock.authState.creds.registered) {
        // সার্ভার পুরোপুরি চালু হওয়ার জন্য একটু সময় দেওয়া হলো
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(botNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log('\n=============================================');
                console.log(`✅ আপনার পেয়ারিং কোড: ${code}`);
                console.log('=============================================\n');
            } catch (error) {
                console.log('কোড তৈরিতে সমস্যা:', error?.message);
            }
        }, 4000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if(connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`কানেকশন বিচ্ছিন্ন (Code: ${reason}). আবার যুক্ত হচ্ছে...`);
            // লগআউট না হলে আবার ট্রাই করবে
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
