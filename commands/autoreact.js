const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/autoreact.json');

// Initialize config
if (!fs.existsSync(configPath)) {
    if (!fs.existsSync(path.dirname(configPath))) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({ enabled: false }));
}

async function autoreactCommand(sock, chatId, message, args) {
    try {
        if (!message.key.fromMe) {
            return await sock.sendMessage(chatId, { text: "❌ This command is for owner only!" }, { quoted: message });
        }

        let config = JSON.parse(fs.readFileSync(configPath));
        const cmd = args[0]?.toLowerCase();

        if (cmd === 'on') {
            config.enabled = true;
            fs.writeFileSync(configPath, JSON.stringify(config));
            await sock.sendMessage(chatId, { text: "✅ *Auto-Reaction* enabled! The bot will now react to all incoming messages." }, { quoted: message });
        } else if (cmd === 'off') {
            config.enabled = false;
            fs.writeFileSync(configPath, JSON.stringify(config));
            await sock.sendMessage(chatId, { text: "❌ *Auto-Reaction* disabled!" }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { 
                text: `╭══✦〔 🎭 *Auto-Reaction* 〕✦══╮\n│\n│ Status: ${config.enabled ? 'Enabled ✅' : 'Disabled ❌'}\n│\n│ *Commands*:\n│ .autoreact on - Enable auto reaction\n│ .autoreact off - Disable auto reaction\n│\n╰══════════════════════╯` 
            }, { quoted: message });
        }
    } catch (e) {
        console.error(e);
    }
}

function isAutoreactEnabled() {
    try {
        const config = JSON.parse(fs.readFileSync(configPath));
        return config.enabled;
    } catch (e) {
        return false;
    }
}

module.exports = { autoreactCommand, isAutoreactEnabled };
