/**
 * ᴍᴀɴɪ ᴍᴅ ☘ - Server Entry Point
 * Combines WhatsApp Bot + Web Server + Keep-Alive
 */

const express = require('express');
const http = require('http');

// ============================================
// 1. CREATE EXPRESS SERVER FIRST
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/web'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    bot: 'ᴍᴀɴɪ ᴍᴅ ☘',
    uptime: process.uptime(),
    memory: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
    timestamp: new Date().toISOString()
  });
});

// Ping endpoint for uptime monitors
app.get('/ping', (req, res) => {
  res.send('Bot is alive! ✅');
});

// Home page - Pair device
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/web/index.html');
});

app.get('/pair-device', (req, res) => {
  res.sendFile(__dirname + '/web/index.html');
});

// ============================================
// 2. START HTTP SERVER
// ============================================
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`\n🌐 [WEB SERVER] Running on port ${PORT}`);
  console.log(`🌐 [WEB SERVER] Pair Device: http://localhost:${PORT}/pair-device\n`);
});

// ============================================
// 3. KEEP-ALIVE / UPTIME MONITOR
// ============================================
console.log('\n🔥 [KEEP-ALIVE] Starting uptime monitor...');

// Log heartbeat every 2 minutes
setInterval(() => {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const memMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
  console.log(`\n🔥 [KEEP-ALIVE] Bot is alive! Uptime: ${days}d ${hours}h ${minutes}m | Memory: ${memMB} MB`);
}, 120000);

// Auto-restart if memory too high
setInterval(() => {
  const used = process.memoryUsage().rss / 1024 / 1024;
  if (used > 900) {
    console.log(`⚠️ [KEEP-ALIVE] RAM too high (${used.toFixed(0)}MB), restarting...`);
    process.exit(1);
  }
}, 30000);

// External ping to keep server awake (for free hosting platforms)
function pingSelf() {
  const url = `http://localhost:${PORT}/api/health`;
  http.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        console.log(`✅ [KEEP-ALIVE] Self-ping successful - Status: ${parsed.status}`);
      } catch (e) {}
    });
  }).on('error', () => {});
}

setInterval(pingSelf, 1400000); // Ping every 23 minutes (before 25min sleep timeout)

// ============================================
// 4. START WHATSAPP BOT
// ============================================
console.log('🤖 [BOT] Starting WhatsApp Bot...\n');

const bot = require('./index');
console.log('🤖 [BOT] WhatsApp Bot module loaded');

// ============================================
// 5. PAIR DEVICE API FOR EXTERNAL REQUESTS
// ============================================
let waSock = null;

// Store reference to the socket when bot connects
const originalStart = require('./index');

// Override: expose socket via global
setTimeout(() => {
  // Try to get socket from the running bot
  if (global.waSock) {
    waSock = global.waSock;
    setupPairAPI();
  }
}, 10000);

function setupPairAPI() {
  app.get('/pair', async (req, res) => {
    try {
      const number = req.query.number;
      if (!number) {
        return res.status(400).json({ error: 'Number is required. Use: /pair?number=9779807044421' });
      }

      const cleanNumber = number.replace(/[^0-9]/g, '');
      
      if (cleanNumber.length < 5 || cleanNumber.length > 20) {
        return res.status(400).json({ error: 'Invalid number format' });
      }

      const whatsappID = cleanNumber + '@s.whatsapp.net';
      const result = await waSock.onWhatsApp(whatsappID);

      if (!result || result.length === 0 || !result[0]?.exists) {
        return res.status(404).json({ error: 'This number is not registered on WhatsApp' });
      }

      const code = await waSock.requestPairingCode(cleanNumber);
      if (code) {
        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
        console.log(`✅ [PAIR API] Code generated for ${cleanNumber}: ${formattedCode}`);
        return res.json({ code: formattedCode, number: cleanNumber });
      } else {
        return res.status(500).json({ error: 'Failed to generate pairing code' });
      }
    } catch (error) {
      console.error('[PAIR API] Error:', error.message);
      return res.status(500).json({ error: 'Failed to generate pairing code' });
    }
  });
}

// Status page
app.get('/status', (req, res) => {
  res.json({
    bot: 'ᴍᴀɴɪ ᴍᴅ ☘',
    version: '3.0.1',
    status: 'running',
    uptime: process.uptime(),
    memory: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
    nodeVersion: process.version,
    platform: process.platform
  });
});
