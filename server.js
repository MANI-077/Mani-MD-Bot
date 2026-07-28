/**
 * ᴍᴀɴɪ ᴍᴅ ☘ - Combined Server Entry Point
 * WhatsApp Bot + Express Web Server + Keep-Alive Monitor
 */

const express = require('express');
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
    bot: 'ᴍᴀɴɪ ᴍᴅ ☘',
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
    bot: 'ᴍᴀɴɪ ᴍᴅ ☘',
    version: '3.0.1',
    status: 'running',
    uptime: process.uptime(),
    memory: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
    nodeVersion: process.version,
    platform: process.platform
  });
});

// ============================================
// 2. START HTTP SERVER FIRST (important for Render!)
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 [WEB SERVER] Running on port ${PORT}`);
  console.log(`🌐 [WEB SERVER] Pair Device: http://localhost:${PORT}/pair-device`);
  console.log(`🌐 [WEB SERVER] Health: http://localhost:${PORT}/api/health\n`);
});

// ============================================
// 3. KEEP-ALIVE / UPTIME MONITOR
// ============================================
console.log('🔥 [KEEP-ALIVE] Starting uptime monitor...');

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

// ============================================
// 4. START WHATSAPP BOT
// ============================================
console.log('🤖 [BOT] Starting WhatsApp Bot...\n');

// Set PORT env var for the bot
process.env.PORT = PORT;

const bot = require('./index');
console.log('🤖 [BOT] WhatsApp Bot module loaded');
