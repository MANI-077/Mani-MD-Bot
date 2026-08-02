/**
 * ᴍᴀɴɪ 𝗠𝗗 ☘ - Combined Server Entry Point
 * WhatsApp Bot + Express Web Server + Socket.IO + Keep-Alive Monitor
 * 
 * v3.0.6: Complete rewrite of pairing flow
 * - Uses file-based pairing code store (survives socket disconnects)
 * - REST API polling for pairing code (works even if Socket.IO drops)
 * - Proper 401 handling - no endless reconnect loops
 * - Dual delivery: Socket.IO + REST polling
 */

const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');

// ============================================
// 1. CREATE EXPRESS SERVER
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'web')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  res.json({
    status: global.waSocket && global.waSocket.user ? 'online' : 'offline',
    bot: 'ᴍᴀɴɪ 𝗠𝗗 ☘',
    uptime: uptime,
    memory: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
    memoryUsagePercent: ((usedMem / totalMem) * 100).toFixed(2),
    cpuUsage: (os.loadavg()[0] * 100 / os.cpus().length).toFixed(2),
    totalUsers: totalUsers,
    activeSockets: activeSockets,
    botConnected: !!(global.waSocket && global.waSocket.user),
    timestamp: new Date().toISOString()
  });
});

// Ping endpoint for uptime monitors (keep bot awake)
app.get('/ping', (req, res) => {
  res.send('Bot is alive! ✅');
});

// Status page
app.get('/status', (req, res) => {
  res.json({
    bot: 'ᴍᴀɴɪ 𝗠𝗗 ☘',
    version: '3.0.6',
    status: 'running',
    uptime: process.uptime(),
    memory: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Pair device page redirect
app.get('/pair-device', (req, res) => {
  res.redirect('/');
});

// ============================================
// PAIRING CODE REST API (survives socket disconnects)
// ============================================

// Get current pairing code (for web UI polling)
app.get('/api/pairing-code', (req, res) => {
  try {
    const { readPairingCode } = require('./index');
    const data = readPairingCode();
    if (data) {
      res.json({ code: data.code, number: data.number, timestamp: data.timestamp });
    } else {
      res.json({ code: null });
    }
  } catch (e) {
    res.json({ code: null, error: e.message });
  }
});

// Request pairing code via REST (more reliable than Socket.IO)
app.post('/api/pair', async (req, res) => {
  const { number } = req.body;
  const cleanNumber = (number || '').replace(/[^0-9]/g, '');
  
  if (!cleanNumber || cleanNumber.length < 10) {
    return res.status(400).json({ error: 'Invalid number. Enter phone with country code.' });
  }

  // Check if pairing code already exists and is still valid
  const { readPairingCode } = require('./index');
  const existing = readPairingCode();
  if (existing && existing.number === cleanNumber) {
    return res.json({ code: existing.code, status: 'existing', message: 'Code still valid' });
  }

  try {
    let sock = global.waSocket;
    
    // Case 1: Bot is connected with registered session - clear and restart for fresh pairing
    if (sock && sock.authState && sock.authState.creds && sock.authState.creds.registered) {
      console.log(`🔄 [REST] Existing session detected. Clearing for fresh pairing...`);
      res.json({ status: 'restarting', message: 'Clearing session and restarting for pairing...' });
      
      try {
        const fs = require('fs');
        const sessionDir = path.join(__dirname, 'session');
        if (fs.existsSync(sessionDir)) {
          const files = fs.readdirSync(sessionDir);
          for (const file of files) {
            if (file !== 'creds.json') {
              fs.unlinkSync(path.join(sessionDir, file));
            }
          }
          fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify({
            noiseKey: sock.authState.creds.noiseKey,
            identityKey: sock.authState.creds.identityKey,
            nextPreKeyId: 1,
            firstUnuploadedPreKeyId: 1,
            serverHasPreKeys: false,
            account: null,
            registrationId: sock.authState.creds.registrationId,
            advSecretKey: null,
            processedHistoryMessages: [],
            nextPreKeyIdToResend: 0,
            pairingEphemeralKeyPair: null,
            registered: false,
            pairingCode: null,
            badProtocolRetryCount: 0,
            me: undefined,
            accountSettings: {}
          }));
        }
      } catch (clearErr) {
        console.error(`⚠️ [REST] Could not clear session: ${clearErr.message}`);
      }
      
      // Restart bot with fresh session
      setTimeout(async () => {
        try {
          const { clearPairingCode } = require('./index');
          clearPairingCode();
          
          const bot = require('./index');
          const newSock = await bot.startXeonBotInc();
          global.waSocket = newSock;
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          if (typeof newSock.requestWebPairingCode === 'function') {
            const code = await newSock.requestWebPairingCode(cleanNumber);
            if (global.ioInstance) global.ioInstance.emit('pairing-code', code);
            console.log(`✅ [REST] Pairing code generated after restart: ${code}`);
          }
        } catch (restartErr) {
          console.error(`❌ [REST] Restart failed: ${restartErr.message}`);
        }
      }, 2000);
      return;
    }
    
    // Case 2: Socket exists but not registered - request pairing code directly
    if (sock && typeof sock.requestWebPairingCode === 'function') {
      try {
        const code = await sock.requestWebPairingCode(cleanNumber);
        if (global.ioInstance) global.ioInstance.emit('pairing-code', code);
        return res.json({ code: code, status: 'success' });
      } catch (pairErr) {
        if (pairErr.message === 'PAIRING_ALREADY_REQUESTED') {
          // Need to restart the connection for a new code
          console.log('🔄 [REST] Pairing already requested, need fresh connection...');
          
          // Clear session and restart
          const { clearPairingCode } = require('./index');
          clearPairingCode();
          
          try {
            const fs = require('fs');
            const sessionDir = path.join(__dirname, 'session');
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
              fs.mkdirSync(sessionDir, { recursive: true });
            }
          } catch (e) {}
          
          // Remove listeners from old socket
          if (global.waSocket) {
            global.waSocket.ev.removeAllListeners();
          }
          
          const bot = require('./index');
          const newSock = await bot.startXeonBotInc();
          global.waSocket = newSock;
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          try {
            const code = await newSock.requestWebPairingCode(cleanNumber);
            if (global.ioInstance) global.ioInstance.emit('pairing-code', code);
            return res.json({ code: code, status: 'success' });
          } catch (e2) {
            console.error('❌ [REST] Failed after restart:', e2.message);
            return res.status(500).json({ error: 'Failed to generate pairing code. Please try again.' });
          }
        }
        throw pairErr;
      }
    }
    
    // Case 3: No socket at all - create a fresh connection and pair
    console.log('🔄 [REST] No socket available, creating fresh connection...');
    const { clearPairingCode } = require('./index');
    clearPairingCode();
    
    // Clear session files
    try {
      const fs = require('fs');
      const sessionDir = path.join(__dirname, 'session');
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        fs.mkdirSync(sessionDir, { recursive: true });
      }
    } catch (e) {}
    
    if (global.waSocket) {
      global.waSocket.ev.removeAllListeners();
    }
    
    const bot = require('./index');
    const newSock = await bot.startXeonBotInc();
    global.waSocket = newSock;
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      const code = await newSock.requestWebPairingCode(cleanNumber);
      if (global.ioInstance) global.ioInstance.emit('pairing-code', code);
      return res.json({ code: code, status: 'success' });
    } catch (e) {
      console.error('❌ [REST] Failed to get pairing code:', e.message);
      return res.status(500).json({ error: 'Failed to generate pairing code. Please try again.' });
    }
    
  } catch (error) {
    console.error(`[REST] Pair error:`, error.message);
    res.status(500).json({ error: 'Failed to generate pairing code: ' + error.message });
  }
});

// ============================================
// 2. START HTTP SERVER FIRST (important for Render!)
// ============================================
const server = http.createServer(app);

// ============================================
// 3. SOCKET.IO SETUP
// ============================================
const { Server: SocketServer } = require('socket.io');
const io = new SocketServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Expose io instance globally so index.js can broadcast pairing codes
global.ioInstance = io;

let users = new Map();
let totalUsers = 0;
let activeSockets = 0;

io.on('connection', (socket) => {
  activeSockets++;
  console.log(`🔌 [SOCKET] New connection: ${socket.id} | Active: ${activeSockets}`);

  // Store user
  socket.on('set-user', (userId) => {
    users.set(userId, socket.id);
    totalUsers++;
    console.log(`👤 [SOCKET] User registered: ${userId}`);
  });

  // Pair request - now delegates to file-based system
  socket.on('pair-request', async ({ userId, number }) => {
    const cleanNumber = number.replace(/[^0-9]/g, '');
    console.log(`📱 [SOCKET] Pair request from ${userId} for number: ${cleanNumber}`);

    if (!cleanNumber || cleanNumber.length < 10) {
      socket.emit('pair-error', 'Invalid number. Please enter a valid WhatsApp number with country code.');
      return;
    }

    // Show loading status
    socket.emit('pair-status', { message: 'Generating pairing code...', loading: true });

    try {
      // Use the REST-like approach: call the pairing logic directly
      const { readPairingCode, clearPairingCode } = require('./index');
      
      // Check if we already have a valid code for this number
      const existing = readPairingCode();
      if (existing && existing.number === cleanNumber) {
        socket.emit('pairing-code', existing.code);
        socket.emit('pair-status', { message: 'Pairing code ready! Enter it in WhatsApp.', loading: false });
        console.log(`✅ [SOCKET] Using existing pairing code: ${existing.code}`);
        return;
      }

      let sock = global.waSocket;
      
      // If socket exists and is ready, try direct pairing
      if (sock && typeof sock.requestWebPairingCode === 'function') {
        try {
          const code = await sock.requestWebPairingCode(cleanNumber);
          socket.emit('pairing-code', code);
          socket.emit('pair-status', { message: 'Pairing code generated! Enter it in WhatsApp.', loading: false });
          console.log(`✅ [SOCKET] Pairing code generated: ${code}`);
          return;
        } catch (pairErr) {
          if (pairErr.message === 'PAIRING_ALREADY_REQUESTED') {
            console.log('🔄 [SOCKET] Pairing already used, need fresh connection...');
          } else {
            console.log('⚠️ [SOCKET] Direct pairing failed:', pairErr.message);
          }
        }
      }
      
      // Need fresh connection
      socket.emit('pair-status', { message: 'Preparing fresh connection...', loading: true });
      
      // Clear everything
      clearPairingCode();
      try {
        const fs = require('fs');
        const sessionDir = path.join(__dirname, 'session');
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          fs.mkdirSync(sessionDir, { recursive: true });
        }
      } catch (e) {}
      
      if (global.waSocket) {
        global.waSocket.ev.removeAllListeners();
      }
      
      const bot = require('./index');
      const newSock = await bot.startXeonBotInc();
      global.waSocket = newSock;
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        const code = await newSock.requestWebPairingCode(cleanNumber);
        socket.emit('pairing-code', code);
        socket.emit('pair-status', { message: 'Pairing code generated! Enter it in WhatsApp.', loading: false });
        console.log(`✅ [SOCKET] Pairing code generated after restart: ${code}`);
      } catch (pairErr) {
        console.error('❌ [SOCKET] Failed to generate code:', pairErr.message);
        socket.emit('pair-error', 'Failed to generate pairing code. Please try again.');
        socket.emit('pair-status', { message: 'Error: ' + pairErr.message, loading: false });
      }
      
    } catch (error) {
      console.error(`[SOCKET] Error:`, error.message);
      socket.emit('pair-error', 'Failed to generate pairing code. Please refresh and try again.');
      socket.emit('pair-status', { message: 'Error: ' + error.message, loading: false });
    }
  });

  socket.on('disconnect', () => {
    activeSockets--;
    console.log(`🔌 [SOCKET] Disconnected: ${socket.id} | Active: ${activeSockets}`);
  });
});

// Broadcast stats every 5 seconds
setInterval(() => {
  io.emit('stats', {
    activeSockets: activeSockets,
    totalUsers: totalUsers,
    botConnected: !!(global.waSocket && global.waSocket.user)
  });
}, 5000);

// ============================================
// 4. REST PAIR ENDPOINT (fallback)
// ============================================
app.get('/pair', async (req, res) => {
  const cleanNumber = (req.query.number || '').replace(/[^0-9]/g, '');
  
  if (!cleanNumber || cleanNumber.length < 10) {
    return res.status(400).json({ error: 'Invalid number' });
  }

  // Check for existing valid code
  try {
    const { readPairingCode } = require('./index');
    const existing = readPairingCode();
    if (existing && existing.number === cleanNumber) {
      return res.json({ code: existing.code });
    }
  } catch (e) {}

  try {
    let sock = global.waSocket;
    
    // If session is already registered, clear it first
    if (sock && sock.authState && sock.authState.creds && sock.authState.creds.registered) {
      console.log(`🔄 [REST] Existing session detected. Clearing for fresh pairing...`);
      res.json({ status: 'restarting', message: 'Clearing existing session and restarting...' });
      
      try {
        const fs = require('fs');
        const sessionDir = path.join(__dirname, 'session');
        if (fs.existsSync(sessionDir)) {
          const files = fs.readdirSync(sessionDir);
          for (const file of files) {
            if (file !== 'creds.json') {
              fs.unlinkSync(path.join(sessionDir, file));
            }
          }
          fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify({
            noiseKey: sock.authState.creds.noiseKey,
            identityKey: sock.authState.creds.identityKey,
            nextPreKeyId: 1,
            firstUnuploadedPreKeyId: 1,
            serverHasPreKeys: false,
            account: null,
            registrationId: sock.authState.creds.registrationId,
            advSecretKey: null,
            processedHistoryMessages: [],
            nextPreKeyIdToResend: 0,
            pairingEphemeralKeyPair: null,
            registered: false,
            pairingCode: null,
            badProtocolRetryCount: 0,
            me: undefined,
            accountSettings: {}
          }));
        }
      } catch (clearErr) {
        console.error(`⚠️ [REST] Could not clear session: ${clearErr.message}`);
      }
      
      setTimeout(async () => {
        try {
          const { clearPairingCode } = require('./index');
          clearPairingCode();
          const bot = require('./index');
          sock = await bot.startXeonBotInc();
          global.waSocket = sock;
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          if (typeof sock.requestWebPairingCode === 'function') {
            const code = await sock.requestWebPairingCode(cleanNumber);
            io.emit('pairing-code', code);
            console.log(`✅ [REST] Pairing code generated: ${code}`);
          }
        } catch (restartErr) {
          console.error(`❌ [REST] Restart failed: ${restartErr.message}`);
        }
      }, 3000);
      return;
    }
    
    // Normal flow
    try {
      if (!sock) throw new Error('No socket');
      if (typeof sock.requestWebPairingCode === 'function') {
        const code = await sock.requestWebPairingCode(cleanNumber);
        res.json({ code: code });
      } else {
        const code = await sock.requestPairingCode(cleanNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
        res.json({ code: formattedCode });
      }
    } catch (err) {
      console.log('🔄 [REST] Socket issue, attempting restart...', err.message);
      const { clearPairingCode } = require('./index');
      clearPairingCode();
      
      try {
        const fs = require('fs');
        const sessionDir = path.join(__dirname, 'session');
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          fs.mkdirSync(sessionDir, { recursive: true });
        }
      } catch (e) {}
      
      if (global.waSocket) {
        global.waSocket.ev.removeAllListeners();
      }
      const bot = require('./index');
      sock = await bot.startXeonBotInc();
      global.waSocket = sock;
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      if (typeof sock.requestWebPairingCode === 'function') {
        const code = await sock.requestWebPairingCode(cleanNumber);
        res.json({ code: code });
      } else {
        const code = await sock.requestPairingCode(cleanNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
        res.json({ code: formattedCode });
      }
    }
  } catch (error) {
    console.error(`[REST] Final Pair error:`, error.message);
    res.status(500).json({ error: 'Failed to generate pairing code' });
  }
});

// Deploy webhook endpoint (Render auto-deploy trigger)
app.get('/deploy', async (req, res) => {
  const token = req.query.key;
  const expectedToken = 'svdYViZ5-dk';
  
  if (token !== expectedToken) {
    return res.status(403).json({ error: 'Invalid deploy token' });
  }
  
  console.log('🚀 [DEPLOY] Deploy webhook triggered!');
  res.json({ status: 'deploy-triggered', message: 'Bot is redeploying...' });
  
  // Graceful restart
  setTimeout(() => {
    console.log('🔄 [DEPLOY] Restarting bot...');
    process.exit(0);
  }, 2000);
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 [WEB SERVER] Running on port ${PORT}`);
  console.log(`🌐 [WEB SERVER] Pair Device: http://localhost:${PORT}/`);
  console.log(`🌐 [WEB SERVER] Health: http://localhost:${PORT}/api/health`);
  console.log(`🌐 [WEB SERVER] Socket.IO: http://localhost:${PORT}/socket.io/`);
  console.log(`🌐 [WEB SERVER] Pairing API: http://localhost:${PORT}/api/pairing-code\n`);
});

// ============================================
// 5. KEEP-ALIVE / UPTIME MONITOR
// ============================================
console.log('🔥 [KEEP-ALIVE] Starting uptime monitor...');

// Self-pinging to keep the bot awake on Render/Heroku
const EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;

if (EXTERNAL_URL) {
  console.log(`🚀 [KEEP-ALIVE] Self-pinging enabled for: ${EXTERNAL_URL}`);
  setInterval(() => {
    const pingUrl = EXTERNAL_URL.endsWith('/') ? `${EXTERNAL_URL}ping` : `${EXTERNAL_URL}/ping`;
    http.get(pingUrl, (res) => {
      console.log(`📡 [KEEP-ALIVE] Self-ping sent to ${pingUrl} | Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error(`❌ [KEEP-ALIVE] Self-ping failed: ${err.message}`);
    });
  }, 2 * 60 * 1000); // Ping every 2 minutes for more aggression
} else {
  console.log('⚠️ [KEEP-ALIVE] RENDER_EXTERNAL_URL not set. Bot might sleep on Render free tier.');
}

// Log heartbeat every 2 minutes
setInterval(() => {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const memMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
  console.log(`\n🔥 [KEEP-ALIVE] Bot is alive! Uptime: ${days}d ${hours}h ${minutes}m | Memory: ${memMB} MB | Sockets: ${activeSockets}`);
}, 120000);

// Auto-restart if memory too high
setInterval(() => {
  const used = process.memoryUsage().rss / 1024 / 1024;
  if (used > 900) {
    console.log(`⚠️ [KEEP-ALIVE] RAM too high (${used.toFixed(0)}MB), restarting...`);
    process.exit(1);
  }
}, 30000);

// ============================================
// 6. START WHATSAPP BOT
// ============================================
console.log('🤖 [BOT] Starting WhatsApp Bot...\n');

// Set PORT env var for the bot
process.env.PORT = PORT;

const bot = require('./index');
console.log('🤖 [BOT] WhatsApp Bot module loaded');

// Automatically start the bot on server boot
bot.startXeonBotInc().then(() => {
  console.log('🤖 [BOT] WhatsApp Bot started successfully');
}).catch(err => {
  console.error('❌ [BOT] Failed to start WhatsApp Bot:', err);
});
