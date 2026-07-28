/**
 * Keep-Alive Bot - Prevents the bot from sleeping
 * Sends periodic pings to keep the server alive
 */

const http = require('http');
const express = require('express');

// Uptime monitor - logs heartbeat
setInterval(() => {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  console.log(`\n🔥 [KEEP-ALIVE] Bot is alive! Uptime: ${days}d ${hours}h ${minutes}m`);
  console.log(`📊 [KEEP-ALIVE] Memory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB\n`);
}, 120000); // Every 2 minutes

// Create a simple HTTP server to serve the pairing web page
function startWebServer(sock) {
  const app = express();
  
  // Serve static files
  app.use(express.static(__dirname + '/web'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'online',
      bot: 'ᴍᴀɴɪ ᴍᴅ ☘',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Ping endpoint for uptime monitors
  app.get('/ping', (req, res) => {
    res.send('Bot is alive!');
  });

  // Pairing code API endpoint
  app.get('/pair', async (req, res) => {
    try {
      const number = req.query.number;
      if (!number) {
        return res.status(400).json({ error: 'Number is required' });
      }

      const cleanNumber = number.replace(/[^0-9]/g, '');
      
      if (cleanNumber.length < 5 || cleanNumber.length > 20) {
        return res.status(400).json({ error: 'Invalid number format' });
      }

      const whatsappID = cleanNumber + '@s.whatsapp.net';
      const result = await sock.onWhatsApp(whatsappID);

      if (!result || result.length === 0 || !result[0]?.exists) {
        return res.status(404).json({ error: 'This number is not registered on WhatsApp' });
      }

      // Request pairing code
      const code = await sock.requestPairingCode(cleanNumber);
      if (code) {
        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
        console.log(`✅ [PAIR WEB] Pairing code generated for ${cleanNumber}: ${formattedCode}`);
        return res.json({ code: formattedCode, number: cleanNumber });
      } else {
        return res.status(500).json({ error: 'Failed to generate pairing code' });
      }
    } catch (error) {
      console.error('[PAIR WEB] Error:', error.message);
      return res.status(500).json({ error: 'Failed to generate pairing code. Please try again.' });
    }
  });

  // Pairing web page
  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/web/index.html');
  });

  // Serve pair page
  app.get('/pair-device', (req, res) => {
    res.sendFile(__dirname + '/web/index.html');
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🌐 [WEB SERVER] Pair device web interface running on port ${PORT}`);
    console.log(`🌐 [WEB SERVER] Access: http://localhost:${PORT}\n`);
  });
}

module.exports = { startWebServer };
