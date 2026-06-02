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
    if (connectionStatus === 'connected') res.send('<h1 style="text-align: center; color: green; margin-top: 50px;">🎉 আলহামদুলিল্লাহ! আপনার বট এখন সম্পূর্ণ প্রস্তুত এবং রানিং!</h1>');
    else if (qrCodeImage) res.send(`<div style="text-align: center; margin-top: 50px;"><img src="${qrCodeImage}" alt="QR"><p>${connectionStatus}</p></div>`);
    else res.send(`<h2 style="text-align:center; margin-top:50px;">${connectionStatus}</h2>`);
});
app.listen(port, () => console.log(`ওয়েব সার্ভার ${port} পোর্টে চলছে...`));

// 🔴 মেমোরি ডেটাবেস
let welcomedUsers = [];
if (fs.existsSync('welcomed_users.json')) {
    welcomedUsers = JSON.parse(fs.readFileSync('welcomed_users.json', 'utf8'));
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
        if (qr) { try { qrCodeImage = await QRCode.toDataURL(qr); connectionStatus = 'QR কোড রেডি! স্ক্যান করুন...'; } catch (err) {} }
        if(connection === 'close') {
            if(lastDisconnect?.error?.output?.statusCode === 401) qrCodeImage = ''; 
            setTimeout(connectToWhatsApp, 5000);
        } else if(connection === 'open') {
            connectionStatus = 'connected'; qrCodeImage = ''; 
            console.log('\n🎉 আলহামদুলিল্লাহ! বট রানিং!\n');
        }
    });

    // 🔴 ম্যাজিক ফাংশন: নির্দিষ্ট সময় পর মেসেজ অটো-ডিলিট করা
    const deleteMessageAfter = (groupId, key, delayMs) => {
        setTimeout(async () => {
            try {
                await sock.sendMessage(groupId, { delete: key });
            } catch (err) {
                console.log('মেসেজ ডিলিট করতে সমস্যা (হয়তো আগেই ডিলিট করা হয়েছে):', err.message);
            }
        }, delayMs);
    };

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if(type !== 'notify') return;
        const msg = messages[0];

        if(!msg.message) return;

        const isGroup = msg.key.remoteJid?.endsWith('@g.us');
        if(!isGroup) return;

        const groupId = msg.key.remoteJid;

        try {
            const groupMeta = await sock.groupMetadata(groupId);
            
            // গ্রুপের নাম চেক
            if (!groupMeta.subject.includes(targetGroupName)) return;

            const sender = msg.key.participant || msg.key.remoteJid;
            const senderNumber = sender.split('@')[0];
            const isFromMe = msg.key.fromMe; 
            
            const isAdmin = groupMeta.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));

            // মেসেজের টেক্সট (ছোট হাতের অক্ষরে কনভার্ট করা হলো যাতে টাইপ করতে সুবিধা হয়)
            const textContent = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim().toLowerCase();
            const msgType = Object.keys(msg.message).find(key => key !== 'senderKeyDistributionMessage' && key !== 'messageContextInfo');
            
            const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(msgType);
            const hasLink = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi.test(textContent);

            // ৩ মিনিট = ১৮০,০০০ মিলি-সেকেন্ড
            const deleteDelay = 3 * 60 * 1000; 

            // ==========================================
            // ১. অ্যান্টি-লিংক ও অ্যান্টি-মিডিয়া
            // ==========================================
            if ((isMedia || hasLink) && !isAdmin && !isFromMe) {
                await sock.sendMessage(groupId, { delete: msg.key }); // সাথে সাথে ডিলিট
                const warningMsg = `⚠️ *দুঃখিত @${senderNumber}!*\nএখানে কোনো লিংক বা মিডিয়া শেয়ার করা সাধারণ মেম্বারদের জন্য অনুমোদিত নয়।\n\nবিশেষ প্রয়োজনে গ্রুপের *অ্যাডমিনদের* নক করুন!\nধন্যবাদ 🥀`;
                const botReply = await sock.sendMessage(groupId, { text: warningMsg, mentions: [sender] });
                
                // ওয়ার্নিং মেসেজটিও ৩ মিনিট পর ডিলিট হয়ে যাবে
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                return; 
            }

            // ==========================================
            // ২. আপডেট করা কমান্ড লজিক (৩ মিনিট টাইমার সহ)
            // ==========================================
            
            // !info কমান্ড
            if (textContent === '!info' || textContent === 'info') {
                const infoText = `সংগঠন সম্পর্কে জানতে ভিজিট করুন!\n🔗 https://hilful-fuzool-dorikandi.pages.dev`;
                const botReply = await sock.sendMessage(groupId, { text: infoText }, { quoted: msg });
                
                // মেম্বারের কমান্ড এবং বটের রিপ্লাই দুটোই ৩ মিনিট পর ডিলিট
                deleteMessageAfter(groupId, msg.key, deleteDelay);
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                return;
            }

            // !rules কমান্ড
            if (textContent === '!rules' || textContent === 'rules' || textContent === 'rules.g') {
                const rulesText = `📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন。\n\nধন্যবাদ 🥀`;
                const botReply = await sock.sendMessage(groupId, { text: rulesText }, { quoted: msg });
                
                deleteMessageAfter(groupId, msg.key, deleteDelay);
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                return;
            }

            // !tagall কমান্ড
            if (textContent === '!tagall' && (isAdmin || isFromMe)) {
                const allMembers = groupMeta.participants.map(p => p.id);
                const botReply = await sock.sendMessage(groupId, { text: `📢 *অ্যাডমিন নোটিশ! সবার দৃষ্টি আকর্ষণ করছি:*`, mentions: allMembers });
                
                deleteMessageAfter(groupId, msg.key, deleteDelay);
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                return;
            }

            // ==========================================
            // ৩. ওয়েলকাম মেসেজ (৩ মিনিট টাইমার সহ)
            // ==========================================
            if (!isFromMe && !welcomedUsers.includes(sender)) {
                
                const welcomeText = `*"হিলফুল ফুজুল"* সংগঠনে আপনাকে স্বাগতম @${senderNumber}! 🥀\n\nএটি দরিকান্দি গ্রামের আলেম সমাজের তত্বাবধানে পরিচালিত একটি অরাজনৈতিক ও অলাভজনক সেবামূলক সংস্থা।\n\n🔰 *সংগঠনের স্লোগান:*\n\nحلف علٰى الحقّ والعدلِ\n_অর্থ: সত্যের শপথ, ন্যায়ের পথ。_\n\nللإنسانيةِ ولِرِضا الرَّبِّ\n_অর্থ: মানবসেবায় নিবেদিত, রবের সন্তুষ্টিতে অনুপ্রাণিত।_\n\n📌 *দৃষ্টি আকর্ষণ:*\nআমাদের সংগঠন সম্পর্কে বিস্তারিত জানতে ভিজিট করুন:\n🔗 https://hilful-fuzool-dorikandi.pages.dev\n\nগ্রুপ পলিসি সম্পর্কে জানতে টাইপ করুন:\n👉 *rules.g*`;
                
                const botReply = await sock.sendMessage(groupId, { text: welcomeText, mentions: [sender] });
                
                // শুধুমাত্র ওয়েলকাম মেসেজটি ৩ মিনিট পর ডিলিট হবে (ইউজারের সালাম/মেসেজ ডিলিট হবে না)
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                
                welcomedUsers.push(sender);
                fs.writeFileSync('welcomed_users.json', JSON.stringify(welcomedUsers));
            }

        } catch (err) {
            console.error('Error:', err);
        }
    });
}
connectToWhatsApp();
