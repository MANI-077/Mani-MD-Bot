/**
 * ᴍᴀɴɪ 𝗠𝗗 ☘ - Combined Server Entry Point
 * WhatsApp Bot + Express Web Server + Socket.IO + Keep-Alive Monitor
 */

const express = require('express');
const http = require('http');
const path = require('path');

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
  res.json({
    status: 'online',
    bot: 'ᴍᴀɴɪ 𝗠𝗗 ☘',
    uptime: process.uptime(),
    memory: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
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
    console.log(`📱 [SOCKET] Pair request from ${userId} for number: ${number}`);

    if (!number || number.length < 10) {
      socket.emit('pair-error', 'Invalid number. Please enter a valid WhatsApp number with country code.');
      return;
    }

    try {
      // Try to get the WhatsApp bot socket for pairing
      if (global.waSocket) {
        const sock = global.waSocket;
        try {
          const code = await sock.requestPairingCode(number);
          const formattedCode = code.match(/.{1,4}/g).join('-');
          
          console.log(`✅ [SOCKET] Pairing code generated for ${number}: ${formattedCode}`);
          socket.emit('pairing-code', formattedCode);
          
          // Check connection status after a delay
          setTimeout(() => {
            if (sock.user) {
              socket.emit('connection-status', { connected: true });
            }
          }, 30000);
        } catch (pairErr) {
          console.error(`❌ [SOCKET] Pairing error: ${pairErr.message}`);
          socket.emit('pair-error', 'Failed to generate pairing code. The bot may not be connected yet. Please try again.');
        }
      } else {
        socket.emit('pair-error', 'Bot is not connected yet. Please wait for the bot to start and try again.');
      }
    } catch (error) {
      console.error(`[SOCKET] Error:`, error);
      socket.emit('pair-error', 'An unexpected error occurred. Please try again.');
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
  const { number } = req.query;
  
  if (!number || number.length < 10) {
    return res.status(400).json({ error: 'Invalid number' });
  }

  if (!global.waSocket) {
    return res.status(503).json({ error: 'Bot not connected yet. Please wait.' });
  }

  try {
    const sock = global.waSocket;
    const code = await sock.requestPairingCode(number);
    const formattedCode = code.match(/.{1,4}/g).join('-');
    console.log(`📱 [REST] Pairing code for ${number}: ${formattedCode}`);
    res.json({ code: formattedCode });
  } catch (error) {
    console.error(`[REST] Pair error:`, error);
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
