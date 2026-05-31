const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ক্লাউড সার্ভারে চলার জন্য বিশেষ কনফিগারেশন
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
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

// QR Code জেনারেট করা (লগস-এ দেখার জন্য)
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('✅ উপরের QR কোডটি স্ক্যান করুন...');
});

// বট কানেক্ট হলে এই মেসেজ দেখাবে
client.on('ready', () => {
    console.log('🎉 আলহামদুলিল্লাহ! আপনার বট এখন সম্পূর্ণ প্রস্তুত এবং রানিং!');
});

// কেউ গ্রুপে জয়েন করলে যা ঘটবে
client.on('group_join', async (notification) => {
    try {
        const chat = await notification.getChat();
        const newUserIds = notification.recipientIds; 

        for (let newUserId of newUserIds) {
            const contact = await client.getContactById(newUserId);

            // ওয়েলকাম মেসেজ (আপনি চাইলে এটি নিজের মতো বাংলায় বা ইংরেজিতে সাজাতে পারেন)
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
