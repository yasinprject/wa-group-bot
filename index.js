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
let connectionStatus = 'বট রানিং আছে... একটু অপেক্ষা করুন'; 
const sessionName = 'session_hilful_fuzool_final'; // 🔴 ফোল্ডারের নতুন নাম

app.get('/', (req, res) => {
    if (connectionStatus === 'connected') res.send('<h1 style="text-align: center; color: green; margin-top: 50px;">🎉 আলহামদুলিল্লাহ! আপনার বট এখন সম্পূর্ণ প্রস্তুত এবং রানিং!</h1>');
    else if (qrCodeImage) res.send(`<div style="text-align: center; margin-top: 50px;"><img src="${qrCodeImage}" alt="QR"><p style="font-size: 20px; color: blue; font-weight: bold;">${connectionStatus}</p></div>`);
    else res.send(`<h2 style="text-align:center; margin-top:50px;">${connectionStatus}</h2>`);
});

// 🔴 ম্যাজিক রিসেট লিংক: বট আটকে গেলে লিঙ্কের শেষে /reset লিখে এন্টার দিলেই সব ঠিক হয়ে যাবে!
app.get('/reset', (req, res) => {
    try {
        fs.rmSync(sessionName, { recursive: true, force: true });
        res.send('<h2 style="color:red; text-align:center;">✅ বটের মেমোরি ক্লিয়ার করা হয়েছে! এবার Render থেকে Manual Deploy > Clear build cache & deploy করুন।</h2>');
    } catch(e) {
        res.send('<h2 style="text-align:center;">ক্লিয়ার করার মতো কোনো মেমোরি নেই।</h2>');
    }
});

app.listen(port, () => console.log(`ওয়েব সার্ভার ${port} পোর্টে চলছে...`));

// মেমোরি ডেটাবেস
let welcomedUsers = [];
let scheduledDeletions = []; 

if (fs.existsSync('welcomed_users.json')) welcomedUsers = JSON.parse(fs.readFileSync('welcomed_users.json', 'utf8'));
if (fs.existsSync('deletions.json')) scheduledDeletions = JSON.parse(fs.readFileSync('deletions.json', 'utf8'));

let timersStarted = false; 

const hijriMonths = {
    1: "মুহাররম", 2: "সফর", 3: "রবিউল আউয়াল", 4: "রবিউস সানি",
    5: "জুমাদাল উলা", 6: "জুমাদাস সানি", 7: "রজব", 8: "শাবান",
    9: "রমজান", 10: "শাওয়াল", 11: "জিলকদ", 12: "জিলহজ"
};

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);

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
            try { 
                qrCodeImage = await QRCode.toDataURL(qr); 
                connectionStatus = '✅ QR কোড রেডি! দ্রুত স্ক্যান করুন...'; 
                console.log('✅ QR কোড ওয়েবসাইটে আপডেট হয়েছে!');
            } catch (err) { console.log(err); } 
        }

        if(connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            
            // 🔴 অটো-ক্লিনার: কানেকশন ফেইল হলে বা স্ক্যান না করলে ভাঙা মেমোরি ডিলিট করে দেবে
            if(reason === 401 || reason === 403 || reason === 405) {
                console.log('❌ স্ক্যান ফেইল হয়েছে! ভাঙা মেমোরি ক্লিয়ার করা হচ্ছে...');
                qrCodeImage = ''; 
                connectionStatus = 'স্ক্যান ফেইল হয়েছে, আবার রিস্টার্ট হচ্ছে...';
                try { fs.rmSync(sessionName, { recursive: true, force: true }); } catch(e) {}
            } 
            setTimeout(connectToWhatsApp, 5000);
        } else if(connection === 'open') {
            connectionStatus = 'connected'; qrCodeImage = ''; 
            console.log('\n🎉 আলহামদুলিল্লাহ! বট রানিং!\n');

            if (!timersStarted) {
                startMonthlyNoticeChecker(sock);
                start7DaysDeletionChecker(sock);
                timersStarted = true;
            }
        }
    });

    const startMonthlyNoticeChecker = (sock) => {
        setInterval(async () => {
            try {
                const now = new Date();
                const dhakaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
                if (dhakaTime.getHours() !== 10) return; 

                const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'numeric' }).formatToParts(now);
                const hDay = parts.find(p => p.type === 'day').value;
                const hMonth = parts.find(p => p.type === 'month').value;

                if (hDay === '1') {
                    let lastMonth = fs.existsSync('last_notice.txt') ? fs.readFileSync('last_notice.txt', 'utf8') : '';
                    if (lastMonth !== hMonth) {
                        const monthName = hijriMonths[hMonth] || "চলতি";
                        const noticeText = `📢 *অ্যাডমিন নোটিশ!*\n\nআসসালামু আলাইকুম!\nসংগঠনের সকল শুভাকাঙ্ক্ষীকে জানানো যাচ্ছে যে, আজ *${monthName}* মাসের এক তারিখ। প্রত্যেককে নিজেদের ধার্যকৃত তহবিল নিম্নোক্ত নাম্বারে পাঠিয়ে দেওয়ার জন্য অনুরোধ করা হলো!\n\n📱 *বিকাশ পার্সোনাল* – 01633-786692\n\nঅর্থ সম্পাদক:\nমাওলানা শাব্বির আহমদ সাহেব`;

                        const groups = Object.values(await sock.groupFetchAllParticipating());
                        const targetGroup = groups.find(g => g.subject.includes(targetGroupName));

                        if (targetGroup) {
                            const botReply = await sock.sendMessage(targetGroup.id, { text: noticeText });
                            const deleteAt = Date.now() + (7 * 24 * 60 * 60 * 1000); 
                            scheduledDeletions.push({ groupId: targetGroup.id, key: botReply.key, deleteAt });
                            fs.writeFileSync('deletions.json', JSON.stringify(scheduledDeletions));
                            fs.writeFileSync('last_notice.txt', hMonth);
                        }
                    }
                }
            } catch (err) {}
        }, 5 * 60 * 1000); 
    };

    const start7DaysDeletionChecker = (sock) => {
        setInterval(async () => {
            if (scheduledDeletions.length === 0) return;
            const now = Date.now();
            let updated = false;

            for (let i = 0; i < scheduledDeletions.length; i++) {
                if (now >= scheduledDeletions[i].deleteAt && !scheduledDeletions[i].done) {
                    try { await sock.sendMessage(scheduledDeletions[i].groupId, { delete: scheduledDeletions[i].key }); } catch (e) {}
                    scheduledDeletions[i].done = true;
                    updated = true;
                }
            }

            if (updated) {
                scheduledDeletions = scheduledDeletions.filter(d => !d.done);
                fs.writeFileSync('deletions.json', JSON.stringify(scheduledDeletions));
            }
        }, 60 * 60 * 1000); 
    };

    const deleteMessageAfter = (groupId, key, delayMs) => {
        setTimeout(async () => {
            try { await sock.sendMessage(groupId, { delete: key }); } catch (err) {}
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
            if (!groupMeta.subject.includes(targetGroupName)) return;

            const sender = msg.key.participant || msg.key.remoteJid;
            const senderNumber = sender.split('@')[0];
            const isFromMe = msg.key.fromMe; 
            const isAdmin = groupMeta.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));

            const textContent = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim().toLowerCase();
            const msgType = Object.keys(msg.message).find(key => key !== 'senderKeyDistributionMessage' && key !== 'messageContextInfo');
            const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(msgType);
            const hasLink = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi.test(textContent);

            const deleteDelay = 3 * 60 * 1000; 

            if ((isMedia || hasLink) && !isAdmin && !isFromMe) {
                await sock.sendMessage(groupId, { delete: msg.key }); 
                const warningMsg = `⚠️ *দুঃখিত @${senderNumber}!*\nএখানে কোনো লিংক বা মিডিয়া শেয়ার করা সাধারণ মেম্বারদের জন্য অনুমোদিত নয়।\n\nবিশেষ প্রয়োজনে গ্রুপের *অ্যাডমিনদের* নক করুন!\nধন্যবাদ 🥀`;
                const botReply = await sock.sendMessage(groupId, { text: warningMsg, mentions: [sender] });
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                return; 
            }

            if (textContent === '!testnotice' && (isAdmin || isFromMe)) {
                const now = new Date();
                const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic', { timeZone: 'Asia/Dhaka', month: 'numeric' }).formatToParts(now);
                const hMonth = parts.find(p => p.type === 'month').value;
                const monthName = hijriMonths[hMonth] || "চলতি";
                const noticeText = `📢 *অ্যাডমিন নোটিশ!*\n\nআসসালামু আলাইকুম!\nসংগঠনের সকল শুভাকাঙ্ক্ষীকে জানানো যাচ্ছে যে, আজ *${monthName}* মাসের এক তারিখ। প্রত্যেককে নিজেদের ধার্যকৃত তহবিল নিম্নোক্ত নাম্বারে পাঠিয়ে দেওয়ার জন্য অনুরোধ করা হলো!\n\n📱 *বিকাশ পার্সোনাল* – 01633-786692\n\nঅর্থ সম্পাদক:\nমাওলানা শাব্বির আহমদ সাহেব\n\n_(এটি একটি টেস্ট মেসেজ)_`;
                await sock.sendMessage(groupId, { text: noticeText }, { quoted: msg });
                return;
            }

            if (textContent === '!info' || textContent === 'info') {
                const infoText = `সংগঠন সম্পর্কে জানতে ভিজিট করুন!\n🔗 https://hilful-fuzool-dorikandi.pages.dev`;
                const botReply = await sock.sendMessage(groupId, { text: infoText }, { quoted: msg });
                deleteMessageAfter(groupId, msg.key, deleteDelay);
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                return;
            }

            if (textContent === '!rules' || textContent === 'rules' || textContent === 'rules.g') {
                const rulesText = `📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন。\n\nধন্যবাদ 🥀`;
                const botReply = await sock.sendMessage(groupId, { text: rulesText }, { quoted: msg });
                deleteMessageAfter(groupId, msg.key, deleteDelay);
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                return;
            }

            if (textContent === '!tagall' && (isAdmin || isFromMe)) {
                const allMembers = groupMeta.participants.map(p => p.id);
                const botReply = await sock.sendMessage(groupId, { text: `📢 *অ্যাডমিন নোটিশ! সবার দৃষ্টি আকর্ষণ করছি:*`, mentions: allMembers });
                deleteMessageAfter(groupId, msg.key, deleteDelay);
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                return;
            }

            if (!isFromMe && !welcomedUsers.includes(sender)) {
                const welcomeText = `*"হিলফুল ফুজুল"* সংগঠনে আপনাকে স্বাগতম @${senderNumber}! 🥀\n\nএটি দরিকান্দি গ্রামের আলেম সমাজের তত্বাবধানে পরিচালিত একটি অরাজনৈতিক ও অলাভজনক সেবামূলক সংস্থা।\n\n🔰 *সংগঠনের স্লোগান:*\n\nحلف علٰى الحقّ والعدلِ\n_অর্থ: সত্যের শপথ, ন্যায়ের পথ。_\n\nللإنسانيةِ ولِرِضا الرَّبِّ\n_অর্থ: মানবসেবায় নিবেদিত, রবের সন্তুষ্টিতে অনুপ্রাণিত।_\n\n📌 *দৃষ্টি আকর্ষণ:*\nআমাদের সংগঠন সম্পর্কে বিস্তারিত জানতে ভিজিট করুন:\n🔗 https://hilful-fuzool-dorikandi.pages.dev\n\nগ্রুপ পলিসি সম্পর্কে জানতে টাইপ করুন:\n👉 *rules.g*`;
                const botReply = await sock.sendMessage(groupId, { text: welcomeText, mentions: [sender] });
                if (botReply) deleteMessageAfter(groupId, botReply.key, deleteDelay);
                
                welcomedUsers.push(sender);
                fs.writeFileSync('welcomed_users.json', JSON.stringify(welcomedUsers));
            }

        } catch (err) {}
    });
}
connectToWhatsApp();
