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

// 🔴 মেমোরি ডেটাবেস
let joinedUsers = {};
let welcomedUsers = [];
if (fs.existsSync('joined_users.json')) joinedUsers = JSON.parse(fs.readFileSync('joined_users.json', 'utf8'));
if (fs.existsSync('welcomed_users.json')) welcomedUsers = JSON.parse(fs.readFileSync('welcomed_users.json', 'utf8'));

const saveMemory = () => {
    fs.writeFileSync('joined_users.json', JSON.stringify(joinedUsers));
    fs.writeFileSync('welcomed_users.json', JSON.stringify(welcomedUsers));
};

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
        if (qr) { try { qrCodeImage = await QRCode.toDataURL(qr); connectionStatus = 'QR কোড রেডি! স্ক্যান করুন...'; } catch (err) {} }
        if(connection === 'close') {
            if(lastDisconnect?.error?.output?.statusCode === 401) qrCodeImage = ''; 
            setTimeout(connectToWhatsApp, 5000);
        } else if(connection === 'open') {
            connectionStatus = 'connected'; qrCodeImage = ''; 
            console.log('\n🎉 আলহামদুলিল্লাহ! বট রানিং!\n');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if(type !== 'notify') return;
        const msg = messages[0];
        const isGroup = msg.key.remoteJid?.endsWith('@g.us');
        if(!isGroup) return;

        const groupId = msg.key.remoteJid;

        try {
            const groupMeta = await sock.groupMetadata(groupId);
            if (!groupMeta.subject.includes(targetGroupName)) return;

            // ==========================================
            // 🔴 লজিক ১: জয়েন করার টাইম সেভ করা (সরাসরি চ্যাটের লেখা থেকে)
            // ==========================================
            if (msg.messageStubType === 27 || msg.messageStubType === 32) {
                const participants = msg.messageStubParameters || [];
                for (let p of participants) {
                    joinedUsers[p] = Date.now(); // টাইম সেভ হলো
                }
                saveMemory();
                return; 
            }

            if(!msg.message || msg.key.fromMe) return;

            const sender = msg.key.participant;
            const senderNumber = sender.split('@')[0];
            const isAdmin = groupMeta.participants.find(p => p.id === sender)?.admin;

            // ==========================================
            // 🔴 লজিক ২: স্মার্ট ওয়েলকাম (১ ঘণ্টার লিমিট)
            // ==========================================
            if (joinedUsers[sender] && !welcomedUsers.includes(sender)) {
                const joinTime = joinedUsers[sender];
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;

                // যদি ১ ঘণ্টার মধ্যে মেসেজ দেয়
                if (now - joinTime <= oneHour) {
                    const welcomeText = `*"হিলফুল ফুজুল"* সংগঠনে আপনাকে স্বাগতম @${senderNumber}! 🥀\n\nএটি দরিকান্দি গ্রামের আলেম সমাজের তত্বাবধানে পরিচালিত একটি অরাজনৈতিক ও অলাভজনক সেবামূলক সংস্থা।\n\n🔰 *সংগঠনের স্লোগান:*\n\nحلف علٰى الحقّ والعدلِ\n_অর্থ: সত্যের শপথ, ন্যায়ের পথ।_\n\nللإنسانيةِ ولِرِضا الرَّبِّ\n_অর্থ: মানবসেবায় নিবেদিত, রবের সন্তুষ্টিতে অনুপ্রাণিত।_\n\n📌 *দৃষ্টি আকর্ষণ:*\nআমাদের সংগঠন সম্পর্কে বিস্তারিত জানতে ভিজিট করুন:\n🔗 https://hilful-fuzool-dorikandi.pages.dev\n\nগ্রুপ পলিসি সম্পর্কে জানতে টাইপ করুন:\n👉 *rules.g*`;
                    
                    await sock.sendMessage(groupId, { text: welcomeText, mentions: [sender] });
                }

                // ওয়েলকাম দেওয়া শেষ, তাকে মেমোরিতে সেভ করে নেওয়া হলো
                welcomedUsers.push(sender);
                saveMemory();
            }

            // ==========================================
            // 🔴 লজিক ৩: অ্যান্টি-লিংক, মিডিয়া ও কমান্ড রিড
            // ==========================================
            const textContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const msgType = Object.keys(msg.message).find(key => key !== 'senderKeyDistributionMessage' && key !== 'messageContextInfo');
            
            const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(msgType);
            const hasLink = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi.test(textContent);

            // সাধারণ মেম্বার লিংক বা মিডিয়া দিলে ডিলিট করবে
            if ((isMedia || hasLink) && !isAdmin) {
                await sock.sendMessage(groupId, { delete: msg.key });
                const warningMsg = `⚠️ *দুঃখিত @${senderNumber}!*\nএখানে কোনো লিংক বা মিডিয়া শেয়ার করা সাধারণ মেম্বারদের জন্য অনুমোদিত নয়।\n\nবিশেষ প্রয়োজনে গ্রুপের *অ্যাডমিনদের* নক করুন!\nধন্যবাদ 🥀`;
                await sock.sendMessage(groupId, { text: warningMsg, mentions: [sender] });
                return; 
            }

            // কমান্ডগুলো
            if (textContent === 'rules.g' || textContent === '!info') {
                const rulesText = `📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন।\n\nধন্যবাদ 🥀`;
                await sock.sendMessage(groupId, { text: rulesText }, { quoted: msg });
                return;
            }

            if (textContent === '!rules') {
                await sock.sendMessage(groupId, { text: `আমাদের ওয়েবসাইট ভিজিট করুন:\n🔗 https://hilful-fuzool-dorikandi.pages.dev` }, { quoted: msg });
                return;
            }

            if (textContent === '!tagall' && isAdmin) {
                const allMembers = groupMeta.participants.map(p => p.id);
                await sock.sendMessage(groupId, { text: `📢 *অ্যাডমিন নোটিশ! সবার দৃষ্টি আকর্ষণ করছি:*`, mentions: allMembers });
                return;
            }

        } catch (err) {}
    });
}
connectToWhatsApp();
