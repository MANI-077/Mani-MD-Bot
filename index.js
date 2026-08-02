/**
 * ᴍᴀɴɪ 𝗠𝗗 ☘ - A WhatsApp Bot
 * Copyright (c) 2025 MANI
 * 
 * v3.0.10: Fixed pairing code generation
 * - Detects stale session on 401 and creates fresh socket for pairing
 * - Auto-generates pairing code after fresh connection with unregistered creds
 * - File-based pairing code store for web UI polling
 */
const path = require('path');
const fs = require('fs');

// Set FFmpeg path for Render/Heroku environments
try {
    const ffmpeg = require('fluent-ffmpeg');
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        console.log('✅ [FFMPEG] Static binary path set successfully');
    }
} catch (e) {
    console.log('⚠️ [FFMPEG] Static binary not found, using system ffmpeg');
}

// ==============================
// BOT DEPENDENCIES
// ==============================
require('./settings')
const { Boom } = require('@hapi/boom')
const chalk = require('chalk')
const FileType = require('file-type')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const store = require('./lib/lightweight_store')
const { downloadSession, uploadSession } = require('./lib/sessionSync');

// ==============================
// PAIRING CODE STORE (File-based, survives socket disconnects)
// ==============================
const PAIRING_FILE = path.join(__dirname, 'pairing-code.json');

function savePairingCode(code, number) {
    const data = {
        code: code,
        number: number,
        timestamp: Date.now(),
        status: 'pending'
    };
    fs.writeFileSync(PAIRING_FILE, JSON.stringify(data, null, 2));
    console.log('💾 [PAIRING] Code saved to file:', code);
}

function readPairingCode() {
    try {
        if (!fs.existsSync(PAIRING_FILE)) return null;
        const data = JSON.parse(fs.readFileSync(PAIRING_FILE, 'utf8'));
        // Expire after 5 minutes
        if (Date.now() - data.timestamp > 300000) {
            clearPairingCode();
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
}

function clearPairingCode() {
    try {
        if (fs.existsSync(PAIRING_FILE)) {
            fs.unlinkSync(PAIRING_FILE);
        }
    } catch (e) {}
}

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000)

let phoneNumber = "9779807044421"
let owner = {};
try { owner = JSON.parse(fs.readFileSync('./data/owner.json')) } catch(e) {}

global.botname = "ᴍᴀɴɪ ᴍᴅ ☘"
global.themeemoji = "•"

// On server (non-TTY), always try to pair if not registered
const isTTY = process.stdin.isTTY;
const pairingCode = !!phoneNumber && isTTY || process.argv.includes("--pairing-code") || !isTTY;
const useMobile = process.argv.includes("--mobile")

// Flag to track if pairing code was already requested
let pairingCodeRequested = false;

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        return Promise.resolve(phoneNumber)
    }
}

// Track connection state
let isConnecting = false;
let reconnectTimer = null;
let pairingSessionActive = false; // NEW: tracks if we're in pairing mode

async function startXeonBotInc(forcePairing = false) {
    // Prevent double connections
    if (isConnecting) {
        console.log('⚠️ [BOT] Connection already in progress, skipping...');
        return global.waSocket;
    }
    isConnecting = true;
    
    // If forcePairing, clear session first so we get a fresh unregistered state
    if (forcePairing) {
        console.log(chalk.cyan('🔄 [BOT] Force pairing mode - clearing stale session...'));
        try { rmSync('./session', { recursive: true, force: true }); } catch (e) {}
        clearPairingCode();
        pairingCodeRequested = false;
        pairingSessionActive = true;
    } else {
        // Restore session from GitHub
        await downloadSession();
    }
    
    let { version, isLatest } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(`./session`)
    const msgRetryCounterCache = new NodeCache()

    console.log(chalk.cyan(`📡 [BOT] Creating socket... registered=${state.creds.registered}, forcePairing=${forcePairing}`));

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: ["Mani-MD", "Safari", "2.0.0"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid)
            let msg = await store.loadMessage(jid, key.id)
            return msg?.message || ""
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    })

    store.bind(XeonBotInc.ev)
    global.waSocket = XeonBotInc;

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') return
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

            if (XeonBotInc?.msgRetryCounterCache) {
                XeonBotInc.msgRetryCounterCache.clear()
            }

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                if (mek.key && mek.key.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: '❌ An error occurred while processing your message.',
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363429143452524@newsletter',
                                newsletterName: 'ᴍᴀɴɪ 𝗠𝗗 ☘',
                                serverMessageId: -1
                            }
                        }
                    }).catch(console.error);
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true
    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    // Auto-request pairing code when not registered
    if (!XeonBotInc.authState.creds.registered) {
        console.log(chalk.cyan('🔑 [PAIRING] Credentials not registered - will request pairing code...'));
        
        setTimeout(async () => {
            try {
                let num = phoneNumber.replace(/[^0-9]/g, '');
                if (!num || num.length < 10) {
                    const numFromQ = await question('Enter your WhatsApp number: ');
                    num = (numFromQ || '').replace(/[^0-9]/g, '');
                }
                if (!num || num.length < 10) {
                    console.log(chalk.red('❌ No valid phone number for pairing.'));
                    return;
                }
                
                console.log(chalk.cyan(`⏳ [PAIRING] Requesting code for ${num}...`));
                let code = await XeonBotInc.requestPairingCode(num);
                pairingCodeRequested = true;
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)));
                
                savePairingCode(code, num);
                
                if (global.ioInstance) {
                    global.ioInstance.emit('pairing-code', code);
                    console.log('✅ [PAIRING] Code broadcast to web UI');
                }
            } catch (error) {
                console.error('❌ [PAIRING] Error requesting pairing code:', error.message);
                pairingCodeRequested = false;
            }
        }, 5000);
    }

    // Connection handler
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s
        if (connection == "open") {
            isConnecting = false;
            console.log(chalk.yellow(`╭══════════════════════✦═✦═✦═✦═✦═══─❒`));
            console.log(chalk.yellow(`│ 🌿 Engaging Connection to => ` + JSON.stringify(XeonBotInc.user, null, 2)));
            console.log(chalk.yellow(`╰══════════════════════✦═✦═✦═✦═✦═══─❒`));

            const botname = "ᴍᴀɴɪ 𝗠𝗗 ☘";
            const ownername = "MANI";
            const repo = "https://github.com/MANI-077/Mani-MD-Bot.git" 
            const prefix = "[.]" 
            const username = "MANI-077";
            const githubLink = `https://github.com/${username}`;
            const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
            
            try {
                await XeonBotInc.sendMessage(botNumber, {
                    image: { url: "./assets/bot_image.jpg" },
                    caption: `╭═✦〔 *ᴄᴏɴɴᴇᴄᴛɪᴏɴ ɴᴏᴛɪᴄᴇ* 〕✦═╮\n\n *ᴍᴀɴɪ 𝗠𝗗 ☘ ᴄᴏɴɴᴇᴄᴛᴇᴅ!* ✅\n\n> _One of the Best Whatsapp Bot._\n\n────────────────\n> 🌟 *ꜱᴛᴀʀ ʀᴇᴘᴏ* : ${repo}\n> 🪄 *ꜰᴏʟʟᴏᴡ ᴜꜱ* : ${githubLink}\n> ⛔ *ʙᴏᴛ ᴘʀᴇꜰɪx* : ${prefix}\n> 📺 *ʏᴏᴜᴛᴜʙᴇ ᴛᴜᴛᴏʀɪᴀʟꜱ* : \n────────────────\n\n> © ${ownername}`,
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363429143452524@newsletter',
                            newsletterName: 'ᴍᴀɴɪ 𝗠𝗗 ☘',
                            serverMessageId: -1
                        }
                    }
                });
            } catch (e) {
                console.log('⚠️ Could not send connection notice:', e.message);
            }

            await delay(500)
            console.log(chalk.green(`│ [ 🪩 ] Bot Connected Successfully`))
            console.log(chalk.green(`╰══════════════════════✦═✦═✦═✦═✦═══─❒`))

            // Follow newsletters
            const newsletterChannels = ["120363429143452524@newsletter"];
            let followed = [];
            let alreadyFollowing = [];
            let failed = [];

            for (const channelJid of newsletterChannels) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const metadata = await XeonBotInc.newsletterMetadata("jid", channelJid);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (metadata.viewer_metadata?.role === "ADMIN" || metadata.viewer_metadata?.role === "OWNER") {
                        alreadyFollowing.push(channelJid);
                    } else {
                        followed.push(channelJid);
                    }
                } catch (error) {
                    failed.push(channelJid);
                }
            } 
            
            pairingSessionActive = false;
        }        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`❌ Connection closed: ${statusCode}.`));
            
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                // 401 = session invalid
                console.log(chalk.yellow('⚠️ Session expired (401). Starting pairing mode...'));
                
                isConnecting = false;
                global.waSocket = null;
                
                // Remove all listeners from the dead socket
                try { XeonBotInc.ev.removeAllListeners(); } catch (e) {}
                
                // After 3 seconds, create a fresh socket with cleared session
                // This will have creds.registered = false and auto-generate pairing code
                if (reconnectTimer) clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(() => {
                    startXeonBotInc(true); // forcePairing = true
                }, 3000);
                
            } else {
                // Other disconnects - normal reconnect
                console.log(chalk.yellow('🔄 Reconnecting in 5 seconds...'));
                isConnecting = false;
                if (reconnectTimer) clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(() => startXeonBotInc(false), 5000);
            }
        }
    })

    // Anticall handler
    const antiCallNotified = new Set();
    XeonBotInc.ev.on('call', async (calls) => {
        try {
            const { readState: readAnticallState } = require('./commands/anticall');
            const state = readAnticallState();
            if (!state.enabled) return;
            for (const call of calls) {
                const callerJid = call.from || call.peerJid || call.chatId;
                if (!callerJid) continue;
                try {
                    if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                        await XeonBotInc.rejectCall(call.id, callerJid);
                    }
                    if (!antiCallNotified.has(callerJid)) {
                        antiCallNotified.add(callerJid);
                        setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                        await XeonBotInc.sendMessage(callerJid, {
                            text: '📵 *Calls are not allowed on this number unless you have permission or send message to request for calls 📞 .*'
                        });
                    }
                } catch (err) {
                    console.error("Anticall error:", err);
                }
            }
        } catch (e) {
            console.error("Anticall handler failed:", e);
        }
    });

    XeonBotInc.ev.on('creds.update', async () => {
        await saveCreds();
        if (!global.firstUploadDone) {
            global.firstUploadDone = true;
            await uploadSession();
        } else if (!global.uploadingSession) {
            global.uploadingSession = true;
            setTimeout(async () => {
                await uploadSession();
                global.uploadingSession = false;
            }, 30000);
        }
    })

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc
}

// Export
module.exports = { startXeonBotInc, savePairingCode, readPairingCode, clearPairingCode, pairingCodeRequested };

// If run directly
if (require.main === module) {
    require('./server');
} else {
    console.log('🤖 [BOT] index.js loaded by server.js');
}
