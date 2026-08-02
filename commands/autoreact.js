const fs = require('fs');
const path = require('path');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');
const configPath = path.join(__dirname, '../data/autoreact.json');

// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path.dirname(USER_GROUP_DATA);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Load userGroupData
function loadUserGroupData() {
    ensureDataDir();
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            return JSON.parse(fs.readFileSync(USER_GROUP_DATA));
        }
    } catch (e) {
        console.error('Error loading userGroupData:', e);
    }
    return { groups: [], chatbot: {} };
}

// Save userGroupData
function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving userGroupData:', e);
    }
}

// Initialize config file for backward compatibility
if (!fs.existsSync(configPath)) {
    ensureDataDir();
    fs.writeFileSync(configPath, JSON.stringify({ enabled: false }));
}

/**
 * Check if global auto-react is enabled (from userGroupData.json)
 */
function isAutoreactEnabled() {
    try {
        const data = loadUserGroupData();
        return data.autoReaction === true;
    } catch (e) {
        return false;
    }
}

/**
 * Check if per-group auto-react is enabled
 */
function isAutoreactEnabledForGroup(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.groups && data.groups.length > 0) {
            const group = data.groups.find(g => g.id === groupId);
            if (group && group.autoReact === true) return true;
        }
        // Fallback to global
        return data.autoReaction === true;
    } catch (e) {
        return false;
    }
}

/**
 * Auto-react command handler - works for both .autoreact and .areact
 */
async function autoreactCommand(sock, chatId, message, args, isOwnerOrSudo) {
    try {
        if (!isOwnerOrSudo) {
            return await sock.sendMessage(chatId, { 
                text: "❌ *This command is for owner/sudo only!*",
                quoted: message
            });
        }

        const action = (args[0] || '').toLowerCase();
        const target = args[1]; // 'group' or 'global'

        if (action === 'on') {
            const data = loadUserGroupData();
            data.autoReaction = true;
            saveUserGroupData(data);
            // Also sync to autoreact.json for backward compatibility
            fs.writeFileSync(configPath, JSON.stringify({ enabled: true }));
            await sock.sendMessage(chatId, { 
                text: "✅ *Auto-Reaction* enabled globally!\nBot will now react to all incoming messages with random emojis.",
                quoted: message
            });
        } else if (action === 'off') {
            const data = loadUserGroupData();
            data.autoReaction = false;
            saveUserGroupData(data);
            fs.writeFileSync(configPath, JSON.stringify({ enabled: false }));
            await sock.sendMessage(chatId, { 
                text: "❌ *Auto-Reaction* disabled globally!",
                quoted: message
            });
        } else if (action === 'status') {
            const data = loadUserGroupData();
            const isEnabled = data.autoReaction === true;
            await sock.sendMessage(chatId, { 
                text: `╭══✦〔 🎭 *Auto-Reaction Status* 〕✦══╮\n│\n│ Global: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n│\n│ *Commands:*\n│ .autoreact on - Enable globally\n│ .autoreact off - Disable globally\n│ .areact on - Same as above\n│ .areact off - Same as above\n│\n╰══════════════════════╯`,
                quoted: message
            });
        } else {
            const data = loadUserGroupData();
            const isEnabled = data.autoReaction === true;
            await sock.sendMessage(chatId, { 
                text: `╭══✦〔 🎭 *Auto-Reaction* 〕✦══╮\n│\n│ Status: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n│\n│ *Commands:*\n│ .autoreact on - Enable auto reaction\n│ .autoreact off - Disable auto reaction\n│ .areact on - Same as .autoreact on\n│ .areact off - Same as .autoreact off\n│\n╰══════════════════════╯`,
                quoted: message
            });
        }
    } catch (e) {
        console.error('Error in autoreact command:', e);
    }
}

module.exports = { autoreactCommand, isAutoreactEnabled, isAutoreactEnabledForGroup };
