/**
 * ᴍᴀɴɪ 𝗠𝗗 ☘ - Combined Server Entry Point
 * WhatsApp Bot + Express Web Server + Socket.IO + Keep-Alive Monitor
 * 
 * v3.0.8: Simplified pairing - uses existing socket, no restart needed
 * - After 401, the socket is kept alive and can request pairing directly
 * - No more startXeonBotInc() restarts that crash the bot
 * - Clear session files → reset pairing flag → request code on existing socket
 */

const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

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

// Pair device page redirect
app.get('/pair-device', (req, res) => {
  res.redirect('/');
});

// ============================================
// PAIRING CODE REST API
// ============================================

// Get current pairing code (for web UI polling)
app.get('/api/pairing-code', (req, res) => {
  try {
    const bot = require('./index');
    const data = bot.readPairingCode();
    if (data) {
      res.json({ code: data.code, number: data.number, timestamp: data.timestamp });
    } else {
      res.json({ code: null });
    }
  } catch (e) {
    res.json({ code: null, error: e.message });
  }
});

// Request pairing code via REST
app.post('/api/pair', async (req, res) => {
  const { number } = req.body;
  const cleanNumber = (number || '').replace(/[^0-9]/g, '');
  
  if (!cleanNumber || cleanNumber.length < 10) {
    return res.status(400).json({ error: 'Invalid number. Enter phone with country code.' });
  }

  console.log(`📱 [API] Pairing request for: ${cleanNumber}`);

  try {
    const bot = require('./index');
    
    // Check if pairing code already exists and is still valid
    const existing = bot.readPairingCode();
    if (existing && existing.number === cleanNumber && (Date.now() - existing.timestamp) < 180000) {
      console.log(`✅ [API] Returning existing valid code: ${existing.code}`);
      return res.json({ code: existing.code, status: 'existing', message: 'Code still valid' });
    }

    let sock = global.waSocket;

    // If socket exists (even after 401 disconnect), try to use it
    if (sock) {
      console.log(`🔄 [API] Socket exists. Clearing session for fresh pairing...`);
      
      // Step 1: Clear session files so the socket can re-authenticate
      try {
        const sessionDir = path.join(__dirname, 'session');
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          fs.mkdirSync(sessionDir, { recursive: true });
        }
      } catch (clearErr) {
        console.error(`⚠️ [API] Could not clear session: ${clearErr.message}`);
      }

      // Step 2: Clear pairing code file
      bot.clearPairingCode();

      // Step 3: Wait a moment for the socket to settle after session clear
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 4: Try to request pairing code on the existing socket
      try {
        const code = await sock.requestWebPairingCode(cleanNumber);
        console.log(`✅ [API] Pairing code generated: ${code}`);
        return res.json({ code: code, status: 'success' });
      } catch (pairErr) {
        console.log(`⚠️ [API] requestWebPairingCode failed: ${pairErr.message}`);
        
        // If it says "already requested", we need to reset the flag
        if (pairErr.message === 'PAIRING_ALREADY_REQUESTED') {
          console.log(`🔄 [API] Resetting pairing flag...`);
          bot.pairingCodeRequested = false;
          
          // Try again after resetting the flag
          try {
            const code = await sock.requestWebPairingCode(cleanNumber);
            console.log(`✅ [API] Pairing code generated after flag reset: ${code}`);
            return res.json({ code: code, status: 'success' });
          } catch (retryErr) {
            console.error(`❌ [API] Still failed after reset: ${retryErr.message}`);
          }
        }
        
        // If requestWebPairingCode doesn't exist, try requestPairingCode directly
        if (typeof sock.requestPairingCode === 'function' && typeof sock.requestWebPairingCode !== 'function') {
          try {
            const code = await sock.requestPairingCode(cleanNumber);
            const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`✅ [API] Pairing code generated: ${formattedCode}`);
            return res.json({ code: formattedCode, status: 'success' });
          } catch (err2) {
            console.error(`❌ [API] requestPairingCode also failed: ${err2.message}`);
          }
        }
      }
    }

    // If no socket or all attempts failed, return error with instructions
    console.log(`❌ [API] No valid socket for pairing. Bot needs fresh start.`);
    return res.status(503).json({ 
      error: 'Bot is initializing. Please wait 30 seconds and try again.',
      retryAfter: 30
    });
    
  } catch (error) {
    console.error(`❌ [API] Pair error:`, error.message);
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

  // Pair request via Socket.IO
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
      const bot = require('./index');
      
      // Check existing code
      const existing = bot.readPairingCode();
      if (existing && existing.number === cleanNumber) {
        socket.emit('pairing-code', existing.code);
        socket.emit('pair-status', { message: 'Pairing code ready!', loading: false });
        return;
      }

      let sock = global.waSocket;
      
      if (sock) {
        // Clear session
        try {
          const sessionDir = path.join(__dirname, 'session');
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            fs.mkdirSync(sessionDir, { recursive: true });
          }
        } catch (e) {}
        
        bot.clearPairingCode();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const code = await sock.requestWebPairingCode(cleanNumber);
          socket.emit('pairing-code', code);
          socket.emit('pair-status', { message: 'Pairing code ready! Enter it in WhatsApp.', loading: false });
          console.log(`✅ [SOCKET] Code generated: ${code}`);
          return;
        } catch (pairErr) {
          if (pairErr.message === 'PAIRING_ALREADY_REQUESTED') {
            bot.pairingCodeRequested = false;
            try {
              const code = await sock.requestWebPairingCode(cleanNumber);
              socket.emit('pairing-code', code);
              socket.emit('pair-status', { message: 'Pairing code ready!', loading: false });
              return;
            } catch (retryErr) {
              console.error(`❌ [SOCKET] Failed after reset: ${retryErr.message}`);
            }
          }
          console.log(`⚠️ [SOCKET] Direct pairing failed: ${pairErr.message}`);
        }
      }

      // Fallback: tell user to try again
      socket.emit('pair-error', 'Bot is initializing. Please wait 30 seconds and try again.');
      socket.emit('pair-status', { message: 'Please retry in 30 seconds...', loading: false });
      
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
// Deploy webhook endpoint (Render auto-deploy trigger)
// ============================================
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

// ============================================
// 4. START LISTENING
// ============================================
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
  }, 2 * 60 * 1000);
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
