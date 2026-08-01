/**
 * ᴍᴀɴɪ 𝗠𝗗 ☘ - Combined Server Entry Point
 * WhatsApp Bot + Express Web Server + Socket.IO + Keep-Alive Monitor
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
    version: '3.0.1',
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

  // Pair request
  socket.on('pair-request', async ({ userId, number }) => {
    const cleanNumber = number.replace(/[^0-9]/g, '');
    console.log(`📱 [SOCKET] Pair request from ${userId} for number: ${cleanNumber}`);

    if (!cleanNumber || cleanNumber.length < 10) {
      socket.emit('pair-error', 'Invalid number. Please enter a valid WhatsApp number with country code.');
      return;
    }

    try {
      let sock = global.waSocket;
      
      // Function to try getting the code
      const getPairingCode = async (currentSock) => {
        if (!currentSock) throw new Error('No socket');
        return await currentSock.requestPairingCode(cleanNumber);
      };

      try {
        // First attempt
        if (!sock) throw new Error('No socket');
        const code = await getPairingCode(sock);
        const formattedCode = code.match(/.{1,4}/g).join('-');
        socket.emit('pairing-code', formattedCode);
      } catch (err) {
        console.log('🔄 [SOCKET] Socket issue, attempting restart...', err.message);
        const index = require('./index');
        sock = await index.startXeonBotInc();
        global.waSocket = sock;
        
        // Wait for socket to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const code = await getPairingCode(sock);
        const formattedCode = code.match(/.{1,4}/g).join('-');
        socket.emit('pairing-code', formattedCode);
      }
      
      // Check connection status after a delay
      setTimeout(() => {
        if (global.waSocket && global.waSocket.user) {
          socket.emit('connection-status', { connected: true });
        }
      }, 30000);

    } catch (error) {
      console.error(`[SOCKET] Final Error:`, error.message);
      socket.emit('pair-error', 'Failed to generate pairing code. Please refresh the page and try again.');
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
    botConnected: !!global.waSocket
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

  try {
    let sock = global.waSocket;
    
    try {
      if (!sock) throw new Error('No socket');
      const code = await sock.requestPairingCode(cleanNumber);
      const formattedCode = code.match(/.{1,4}/g).join('-');
      res.json({ code: formattedCode });
    } catch (err) {
      console.log('🔄 [REST] Socket issue, attempting restart...', err.message);
      const index = require('./index');
      sock = await index.startXeonBotInc();
      global.waSocket = sock;
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const code = await sock.requestPairingCode(cleanNumber);
      const formattedCode = code.match(/.{1,4}/g).join('-');
      res.json({ code: formattedCode });
    }
  } catch (error) {
    console.error(`[REST] Final Pair error:`, error.message);
    res.status(500).json({ error: 'Failed to generate pairing code' });
  }
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 [WEB SERVER] Running on port ${PORT}`);
  console.log(`🌐 [WEB SERVER] Pair Device: http://localhost:${PORT}/`);
  console.log(`🌐 [WEB SERVER] Health: http://localhost:${PORT}/api/health`);
  console.log(`🌐 [WEB SERVER] Socket.IO: http://localhost:${PORT}/socket.io/\n`);
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
