const axios = require('axios');

async function monitorCommand(sock, chatId, message) {
    const externalUrl = process.env.RENDER_EXTERNAL_URL || "https://mani-md-bot-fdkz.onrender.com";
    
    const statusMsg = 
`🛡️ *MANI-MD UPTIME MONITOR* 🛡️

📊 *Current Status:* Online ✅
⏳ *Uptime:* ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m
💻 *Platform:* Render (Free Tier)

⚠️ *Why does it go offline?*
Render puts free apps to sleep after 15 minutes of no web activity. WhatsApp messages do NOT count as activity.

🚀 *How to keep it online 24/7:*
1. Go to *UptimeRobot.com* (Free).
2. Create an *HTTP(s)* monitor.
3. Use this URL: \`${externalUrl}/ping\`
4. Set interval to *5 minutes*.

🔗 *Your Ping URL:* 
${externalUrl}/ping

> Powered by ᴍᴀɴɪ ᴍᴅ ☘`;

    await sock.sendMessage(chatId, { text: statusMsg }, { quoted: message });
}

module.exports = monitorCommand;
