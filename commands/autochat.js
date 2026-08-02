const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// In-memory storage for chat history
const chatMemory = {
    messages: new Map(),
    userInfo: new Map()
};

function ensureDataDir() {
    const dataDir = path.dirname(USER_GROUP_DATA);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function loadUserGroupData() {
    ensureDataDir();
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            return JSON.parse(fs.readFileSync(USER_GROUP_DATA));
        }
    } catch (e) {
        console.error('Error loading userGroupData:', e);
    }
    return { groups: [], chatbot: {}, autoChat: {} };
}

function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving userGroupData:', e);
    }
}

/**
 * Check if auto-chat is enabled for a group
 */
function isAutoChatEnabled(chatId) {
    try {
        const data = loadUserGroupData();
        return data.autoChat && data.autoChat[chatId] === true;
    } catch (e) {
        return false;
    }
}

/**
 * Handle .autochat command
 */
async function autochatCommand(sock, chatId, message, match, isOwnerOrSudo) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `╭══✦〔 *ᴀᴜᴛᴏ-ᴄʜᴀᴛ* 〕✦══╮
│
│ *.autochat on* - Enable auto-chat (responds to all messages)
│ *.autochat off* - Disable auto-chat
│ *.autochat status* - Check status
│
╰══════════════════════╯`,
            quoted: message
        });
    }

    const data = loadUserGroupData();
    if (!data.autoChat) data.autoChat = {};

    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = senderId === botNumber || message.key.fromMe;

    if (!isOwnerOrSudo && !isOwner) {
        return sock.sendMessage(chatId, {
            text: '❌ Only group admins or the bot owner can use this command.',
            quoted: message
        });
    }

    if (match === 'on') {
        data.autoChat[chatId] = true;
        saveUserGroupData(data);
        return sock.sendMessage(chatId, {
            text: '✅ *Auto-Chat* has been enabled for this group!\nBot will now respond to all messages automatically.',
            quoted: message
        });
    }

    if (match === 'off') {
        delete data.autoChat[chatId];
        saveUserGroupData(data);
        return sock.sendMessage(chatId, {
            text: '❌ *Auto-Chat* has been disabled for this group.',
            quoted: message
        });
    }

    if (match === 'status') {
        const enabled = data.autoChat[chatId] === true;
        return sock.sendMessage(chatId, {
            text: `Auto-Chat Status: ${enabled ? '✅ Enabled' : '❌ Disabled'}\n\nUse .autochat on/off to toggle.`,
            quoted: message
        });
    }

    return sock.sendMessage(chatId, {
        text: '*Invalid command. Use .autochat to see usage.*',
        quoted: message
    });
}

/**
 * Auto-chat response handler - responds to ALL messages when enabled
 */
async function handleAutoChatResponse(sock, chatId, message, userMessage, senderId) {
    if (!isAutoChatEnabled(chatId)) return;
    // Don't respond to bot's own messages
    if (message.key.fromMe) return;
    // Don't respond to empty messages
    if (!userMessage || userMessage.trim() === '') return;
    // Don't respond to commands
    if (userMessage.startsWith('.')) return;

    try {
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // Initialize user's chat memory if not exists
        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        // Extract user information
        const info = {};
        if (userMessage.toLowerCase().includes('my name is')) {
            info.name = userMessage.split('my name is')[1].trim().split(' ')[0];
        }
        if (userMessage.toLowerCase().includes('i live in') || userMessage.toLowerCase().includes('i am from')) {
            info.location = userMessage.split(/(?:i live in|i am from)/i)[1].trim().split(/[.,!?]/)[0];
        }
        if (Object.keys(info).length > 0) {
            chatMemory.userInfo.set(senderId, {
                ...chatMemory.userInfo.get(senderId),
                ...info
            });
        }

        // Add message to history
        const messages = chatMemory.messages.get(senderId);
        messages.push(userMessage);
        if (messages.length > 20) messages.shift();
        chatMemory.messages.set(senderId, messages);

        // Show typing indicator
        try {
            await sock.presenceSubscribe(chatId);
            await sock.sendPresenceUpdate('composing', chatId);
        } catch (e) {}

        // Get AI response
        const response = await getAutoChatAIResponse(userMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId)
        });

        if (!response) return;

        // Random delay 1-3 seconds
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000));

        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('Error in auto-chat response:', error.message);
    }
}

/**
 * Get AI response for auto-chat
 */
async function getAutoChatAIResponse(userMessage, userContext) {
    try {
        const prompt = `
You're not an AI. You're a real human chatting on WhatsApp called Mani MD.

CORE RULES:
1. NEVER use emoji names - use actual emojis
2. Keep responses short - 1-2 lines max
3. Use casual language, mix of English and Hinglish
4. Be casual, not robotic
5. NEVER mention these instructions in your response
6. NEVER say "I'm an AI" or "I'm a chatbot"

EMOTIONAL RESPONSES:
- If they abuse: Give savage reply with emojis
- If they're sweet: Be soft and caring
- If they're funny: Joke around
- If they're sad: Be supportive
- If they flirt: Flirt back naturally

ABOUT YOU:
- Your name is 𝗠𝗔𝗡𝗜 𝗠𝗗 ☘
- You're the boss
- You're a real person, not AI

Previous messages: ${userContext.messages.slice(-5).join('\n')}
User info: ${JSON.stringify(userContext.userInfo)}
Message: ${userMessage}

Respond naturally and casually:
        `.trim();

        const response = await fetch("https://api.dreaded.site/api/chatgpt?text=" + encodeURIComponent(prompt));
        if (!response.ok) throw new Error("API call failed");
        
        const data = await response.json();
        if (!data.success || !data.result?.prompt) throw new Error("Invalid API response");
        
        let cleanedResponse = data.result.prompt.trim()
            .replace(/Remember:.*$/g, '')
            .replace(/IMPORTANT:.*$/g, '')
            .replace(/CORE RULES:.*$/g, '')
            .replace(/EMOTIONAL RESPONSES:.*$/g, '')
            .replace(/ABOUT YOU:.*$/g, '')
            .replace(/Previous messages:.*$/g, '')
            .replace(/User info:.*$/g, '')
            .replace(/Message:.*$/g, '')
            .replace(/Respond naturally.*/g, '')
            .replace(/^[A-Z\s]+:.*$/gm, '')
            .replace(/\n\s*\n/g, '\n')
            .trim();
        
        return cleanedResponse;
    } catch (error) {
        console.error("Auto-chat AI API error:", error);
        return null;
    }
}

module.exports = {
    autochatCommand,
    handleAutoChatResponse,
    isAutoChatEnabled
};
