/**
 * 🛡️ MANI-MD STANDALONE MONITOR
 * Run this script on a DIFFERENT free hosting service (like Koyeb, Railway, or another Render account)
 * to keep your main bot alive 24/7.
 */

const http = require('http');

// Replace with your main bot's URL
const TARGET_URL = process.env.TARGET_URL || "https://mani-md-bot-fdkz.onrender.com/ping";
const INTERVAL = 5 * 60 * 1000; // 5 minutes

console.log(`🚀 Starting monitor for: ${TARGET_URL}`);

function ping() {
    http.get(TARGET_URL, (res) => {
        console.log(`[${new Date().toISOString()}] 📡 Ping sent. Status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`[${new Date().toISOString()}] ❌ Ping failed: ${err.message}`);
    });
}

// Initial ping
ping();

// Periodic ping
setInterval(ping, INTERVAL);

// Simple web server to satisfy hosting providers
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Monitor is running! 🛡️');
}).listen(process.env.PORT || 8080);
