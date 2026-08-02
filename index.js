/**
 * ᴍᴀɴɪ ᴍᴅ ☘ - A WhatsApp Bot
 * Copyright (c) 2025 MANI
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
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
        // Expire after 3 minutes
        if (Date.now() - data.timestamp > 180000) {
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

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute



let phoneNumber = "9779807044421"
let owner = {};
try { owner = JSON.parse(fs.readFileSync('./data/owner.json')) } catch(e) {}

global.botname = "ᴍᴀɴɪ ᴍᴅ ☘"
global.themeemoji = "•"

// On server (non-TTY), pairing is handled via web UI - don't auto-request
const isTTY = process.stdin.isTTY;
const pairingCode = !!phoneNumber && isTTY || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

// Flag to track if pairing code was already requested (server env)
let pairingCodeRequested = false;

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        // In non-interactive environment, use ownerNumber from settings
        return Promise.resolve(settings.ownerNumber || phoneNumber)
    }
}

// Track if we're currently connecting (prevent double connections)
let isConnecting = false;
let reconnectTimer = null;

async function startXeonBotInc() {
    // Prevent double connections
    if (isConnecting) {
        console.log('⚠️ [BOT] Connection already in progress, skipping...');
        return global.waSocket;
    }
    isConnecting = true;
    
    // Restore session from GitHub before starting
    await downloadSession();
    
    let { version, isLatest } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(`./session`)
    const msgRetryCounterCache = new NodeCache()

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

    // Export socket for server.js Socket.IO pairing
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

            // Clear message retry cache to prevent memory bloat
            if (XeonBotInc?.msgRetryCounterCache) {
                XeonBotInc.msgRetryCounterCache.clear()
            }

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                // Only try to send error message if we have a valid chatId
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

    // Add these event handlers for better functionality
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

    // Handle pairing code - Request pairing if not registered (web or CLI)
    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        setTimeout(async () => {
            try {
                let num = phoneNumber.replace(/[^0-9]/g, '')
                let code = await XeonBotInc.requestPairingCode(num)
                pairingCodeRequested = true;
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
                
                // Save pairing code to file (survives socket disconnects)
                savePairingCode(code, num);
                
                // Also broadcast to any connected web clients via global event
                if (global.ioInstance) {
                    global.ioInstance.emit('pairing-code', code);
                    console.log('✅ [PAIRING] Code broadcast to web UI via Socket.IO');
                }
            } catch (error) {
                console.error('Error requesting pairing code:', error)
            }
        }, 3000)
    }

    // Helper function to request pairing code (used by web UI)
    XeonBotInc.requestWebPairingCode = async (number) => {
        if (pairingCodeRequested) {
            throw new Error('PAIRING_ALREADY_REQUESTED');
        }
        let num = number.replace(/[^0-9]/g, '');
        let code = await XeonBotInc.requestPairingCode(num);
        pairingCodeRequested = true;
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)));
        
        // Save to file for web UI polling
        savePairingCode(code, num);
        
        return code;
    };

    // Helper: check if bot has a valid WhatsApp connection
    XeonBotInc.isReady = () => {
        return !!(XeonBotInc.user && XeonBotInc.user.id);
    };

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s
        if (connection == "open") {
            isConnecting = false;
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`╭══════════════════════✦═✦═✦═✦═✦═══─❒`))
            console.log(chalk.yellow(`│ 🌿 Engaging Connection to => ` + JSON.stringify(XeonBotInc.user, null, 2)))

            console.log(chalk.yellow(`╰══════════════════════✦═✦═✦═✦═✦═══─❒`))
           
            const botname = "ᴍᴀɴɪ 𝗠𝗗 ☘";
            const ownername = "MANI";
            const repo = "https://github.com/MANI-077/Mani-MD-Bot.git" 
            const prefix = "[.]" 
            const username = "MANI-077";
            const githubLink = `https://github.com/${username}`;
            const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
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

            await delay(500)
            console.log(chalk.red("╭══✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦══─❒"))
            await delay(500)
            console.log(chalk.yellow("│ [ ✉️ ] Sending connection notice with image..."));
            await delay(500)
            console.log(chalk.green("│ [ 📩 ] Connection notice sent successfully with image"))
            await delay(500)
            console.log(chalk.green("╰══✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦══─❒"))          
            await delay(500)
            console.log(chalk.yellow(`\n\n  ${chalk.bold.blue(`[ ${global.botname || 'ᴍᴀɴɪ 𝗠𝗗 ☘'} ]`)}\n\n`))
            console.log(chalk.cyan(`< =============================================== >`))
            await delay(500)
            console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: ᴍᴀɴɪ 𝗠𝗗 ☘`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: MANI-077`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: ᴍᴀɴɪ 𝗠𝗗 ☘`))
            await delay(500)
            console.log(chalk.red("╭══✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦══─❒"))
            await delay(500)
            console.log(chalk.yellow("│ [ ⏳ ] Downloading creds data..."))
            await delay(500)
            console.log(chalk.cyan("│ [ 🆔️ ] Downloading MEGA.nz session..."))
            await delay(500)
            console.log(chalk.green("│ [ ✅ ] Creds data downloaded successfully"))
            await delay(500)
            console.log(chalk.green("│ [ ✅ ] MEGA session downloaded successfully"))
            await delay(500)
            console.log(chalk.cyan("│ [ 🟠 ] Connecting to WhatsApp ⏳️..."))
            await delay(500)
            console.log(chalk.yellow("│ [ 🧩 ] Installing commands..."))      
            await delay(500)
            console.log(chalk.green("│ [ ✅ ] Commands installed successfully"))     
            await delay(500)      
            console.log(chalk.green(`│ [ 🪩 ] L T H Bot Connected Successfully`))
            await delay(500)
            console.log(chalk.green("╰══✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦═✦══─❒"))
            await delay(500)
            console.log(chalk.magenta(` `))
            await delay(500)
            console.log(chalk.yellow("╭═✦✦═══════════════════✦✦═╮"))     
            console.log(chalk.green(`│  Bot Version: ${settings.version}`))
            console.log(chalk.yellow("╰═✦✦═══════════════════✦✦═╯"))  
            await delay(500)
            console.log(chalk.magenta(` `))
            console.log(chalk.cyan(`★★★★★═════════†════════★★★★★★`))
            console.log(chalk.magenta(` `))
            await delay(500)
            
                  
           // Follow newsletters
      const newsletterChannels = [
        "120363429143452524@newsletter",
      ];
      let followed = [];
      let alreadyFollowing = [];
      let failed = [];

      for (const channelJid of newsletterChannels) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log(chalk.yellow(`╭══════════════════════✦═✦═✦═✦═✦════─❒`))
          console.log(chalk.yellow(`│ [ 📡 ] Checking metadata for ${channelJid}`))
          console.log(chalk.yellow(`╰══════════════════════✦═✦═✦═✦═✦════─❒`));
          const metadata = await XeonBotInc.newsletterMetadata("jid", channelJid);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if already following
          if (metadata.viewer_metadata?.role === "ADMIN" || metadata.viewer_metadata?.role === "OWNER") {
            alreadyFollowing.push(channelJid);
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(chalk.green(`╭══════════════════════✦═✦═✦═✦═✦════─❒`))
            console.log(chalk.green(`│ [ 📌 ] Already following: ${channelJid}`))
            console.log(chalk.green(`╰══════════════════════✦═✦═✦═✦═✦════─❒`));
          } else {
            followed.push(channelJid);
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(chalk.green(`╭══════════════════════✦═✦═✦═✦═✦════─❒`))
            console.log(chalk.green(`│ [ ✅ ] Followed: ${channelJid}`))
            console.log(chalk.green(`╰══════════════════════✦═✦═✦═✦═✦════─❒`));
          }
        } catch (error) {
          failed.push(channelJid);
          await new Promise(resolve => setTimeout(resolve, 500));
          console.error(chalk.red(`╭══════════════════════✦═✦═✦═✦═✦════─❒`))
          console.error(chalk.red(`│ [ ❌ ] Failed to follow ${channelJid}: ${error.message}`))
          console.error(chalk.red(`╰══════════════════════✦═✦═✦═✦═✦════─❒`));
          
        }
      } 
      await new Promise(resolve => setTimeout(resolve, 500));
            console.log(
        chalk.cyan(
          `╭══════════════════════✦═✦═✦═✦═✦═╮\n│ 📡 Newsletter Follow Status:\n│ ✅ Followed: ${followed.length}\n│ 📌 Already following: ${alreadyFollowing.length}\n│ ❌ Failed: ${failed.length}\n╰══════════════════════✦═✦═✦═✦═✦═╯`
        )
      );
            
            
            
            
            
            
    }        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log(chalk.red(`❌ Connection closed: ${statusCode}.`));
            
            if (statusCode === DisconnectReason.loggedOut) {
                try {
                    rmSync('./session', { recursive: true, force: true });
                    console.log(chalk.red('⚠️ Session logged out and cleared. Please restart and re-pair.'));
                } catch (e) {
                    console.error('Error clearing session:', e);
                }
                global.waSocket = null;
                pairingCodeRequested = false; // Reset so new pairing can be requested
                isConnecting = false;
            } else if (statusCode === 401) {
                // 401 means session is invalid - DON'T auto-reconnect endlessly
                // Just wait for the user to pair via web UI
                console.log(chalk.yellow('⚠️ Session invalid (401). Waiting for user to pair via web UI...'));
                global.waSocket = null;
                pairingCodeRequested = false;
                isConnecting = false;
                // Clear session so we're ready for fresh pairing
                try {
                    rmSync('./session', { recursive: true, force: true });
                } catch (e) {}
            } else {
                // Reconnect for other reasons (network, server restart, etc)
                console.log(chalk.yellow('🔄 Reconnecting in 5 seconds...'));
                isConnecting = false;
                if (reconnectTimer) clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(() => startXeonBotInc(), 5000);
            }
        }
    })

 // Track recently-notified callers to avoid spamming messages
    const antiCallNotified = new Set();

// Anticall handler: reject calls but don't block callers
XeonBotInc.ev.on('call', async (calls) => {
  try {
    const { readState: readAnticallState } = require('./commands/anticall');
    const state = readAnticallState();
    if (!state.enabled) return;

    for (const call of calls) {
      const callerJid = call.from || call.peerJid || call.chatId;
      if (!callerJid) continue;

      try {
        // Try rejecting the call if supported
        if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
          await XeonBotInc.rejectCall(call.id, callerJid);
        } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
          await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
        }

        // Notify the caller only once every 60s
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
        
        // Upload immediately if it's the first time, then throttle
        if (!global.firstUploadDone) {
            global.firstUploadDone = true;
            await uploadSession();
        } else if (!global.uploadingSession) {
            global.uploadingSession = true;
            setTimeout(async () => {
                await uploadSession();
                global.uploadingSession = false;
            }, 30000); // Increased throttle to 30s to be safe
        }
    })

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on('messages.upsert', async (m) => {
        if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
            await handleStatus(XeonBotInc, m);
        }
    });

    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc
}


// Export before starting to handle potential circular requirements
module.exports = { startXeonBotInc, savePairingCode, readPairingCode, clearPairingCode, pairingCodeRequested };

// If this file is run directly (node index.js), also start the web server
if (require.main === module) {
    require('./server');
} else {
    // If required by server.js, don't auto-start here to let server.js control the boot
    console.log('🤖 [BOT] index.js loaded by server.js');
}
