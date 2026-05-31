const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const puppeteer = require('puppeteer'); // নতুন যুক্ত করা হলো

// Render-এর জন্য ডামি সার্ভার
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('আলহামদুলিল্লাহ, আপনার হোয়াটসঅ্যাপ বট সচল আছে!');
});

app.listen(port, () => {
    console.log(`ওয়েব সার্ভার ${port} পোর্টে চলছে...`);
});

// বটের মূল কোড
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: puppeteer.executablePath(), // ১০০% কাজ করার জন্য এই লাইনটি যুক্ত করা হলো
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('✅ উপরের QR কোডটি আপনার হোয়াটসঅ্যাপ দিয়ে স্ক্যান করুন...');
});

client.on('ready', () => {
    console.log('🎉 আলহামদুলিল্লাহ! আপনার বট এখন সম্পূর্ণ প্রস্তুত এবং রানিং!');
});

client.on('group_join', async (notification) => {
    try {
        const chat = await notification.getChat();
        const newUserIds = notification.recipientIds; 

        for (let newUserId of newUserIds) {
            const contact = await client.getContactById(newUserId);

            const welcomeMessage = `স্বাগতম @${contact.number}! 🎉\n\nআমাদের গ্রুপে আপনাকে পেয়ে আমরা আনন্দিত।\n\n📜 *গ্রুপের রুলস:*\n১. স্প্যাম মেসেজ দেওয়া নিষেধ।\n২. সবাইকে সম্মান দিয়ে কথা বলুন।\n৩. অপ্রাসঙ্গিক পোস্ট থেকে বিরত থাকুন।\n\nধন্যবাদ!`;

            await chat.sendMessage(welcomeMessage, {
                mentions: [contact]
            });
            console.log(`নতুন মেম্বারকে ওয়েলকাম মেসেজ পাঠানো হয়েছে!`);
        }
    } catch (error) {
        console.error('মেসেজ পাঠাতে এরর:', error);
    }
});

client.initialize();
