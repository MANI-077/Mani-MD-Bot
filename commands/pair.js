const axios = require('axios');
const { sleep } = require('../lib/myfunc');

async function pairCommand(sock, chatId, message, q) {
    try {
        if (!q) {
            return await sock.sendMessage(chatId, {
                text: "Please provide a valid WhatsApp number\nExample: .pair 2567899XXXXX"
            }, { quoted: message });
        }

        const numbers = q.split(',')
            .map((v) => v.replace(/[^0-9]/g, ''))
            .filter((v) => v.length > 5 && v.length < 20);

        if (numbers.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "Invalid number❌️ Please use the correct format!"
            }, { quoted: message });
        }

        for (const number of numbers) {
            const whatsappID = number + '@s.whatsapp.net';
            console.log("Checking WhatsApp ID:", whatsappID);

            const result = await sock.onWhatsApp(whatsappID);
            console.log("onWhatsApp result:", result);

            if (!result || result.length === 0 || !result[0]?.exists) {
                await sock.sendMessage(chatId, {
                    text: `This number (${number}) is not registered on WhatsApp❗️`
                }, { quoted: message });
                continue;
            }

            await sock.sendMessage(chatId, { text: `⏳ Generating pairing code for ${number}, Please wait...`
            }, { quoted: message });
            await sleep(1000);

            // Try local pairing first (via server.js)
            try {
                const port = process.env.PORT || 3000;
                const response = await axios.post(`http://localhost:${port}/api/pair`, {
                    number: number
                }, {
                    timeout: 30000,
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log("Local API response:", response.data);

                if (response.data && response.data.status === 'restarting') {
                    // Wait for the bot to restart and generate pairing code
                    await sleep(15000);
                    
                    // Poll for the pairing code
                    let codeFound = null;
                    for (let attempt = 0; attempt < 20; attempt++) {
                        try {
                            const codeRes = await axios.get(`http://localhost:${port}/api/pairing-code`, {
                                timeout: 5000
                            });
                            if (codeRes.data && codeRes.data.code) {
                                codeFound = codeRes.data.code;
                                break;
                            }
                        } catch (e) {
                            // Still waiting...
                        }
                        await sleep(3000);
                    }

                    if (codeFound) {
                        await sock.sendMessage(chatId, {
                            text: `✅ *Pairing Code:*\n\n\`${codeFound}\`\n\n📱 Open WhatsApp > Linked Devices > Link a Device\n🔢 Enter the code above\n\n> 𝗠𝗔𝗡𝗜 𝗠𝗗 ☘`
                        }, { quoted: message });
                    } else {
                        await sock.sendMessage(chatId, {
                            text: `⏳ Bot is restarting. Your pairing code will be available at the web dashboard shortly.\n\nVisit: ${process.env.RENDER_EXTERNAL_URL || 'your-deployed-url'}\n\n> 𝗠𝗔𝗡𝗜 𝗠𝗗 ☘`
                        }, { quoted: message });
                    }
                } else {
                    throw new Error('Invalid response from server');
                }
            } catch (apiError) {
                console.error('Local API Error:', apiError.message);
                // Fallback: use manual pairing method directly
                try {
                    const code = await sock.requestPairingCode(number);
                    
                    const formattedCode = code.match(/.{1,4}/g).join('-');
                    
                    await sock.sendMessage(chatId, {
                        text: `✅ *Pairing Code:*\n\n\`${formattedCode}\`\n\n📱 Open WhatsApp > Linked Devices > Link a Device\n🔢 Enter the code above\n\n> 𝗠𝗔𝗡𝗜 𝗠𝗗 ☘`
                    }, { quoted: message });
                } catch (manualErr) {
                    console.error('Manual pairing error:', manualErr);
                    const errorMessage = apiError.message === 'Service Unavailable'
                        ? "⚠️ Service is currently unavailable. Please try again later."
                        : "❌ Failed to generate pairing code. Please try again later.";
                    await sock.sendMessage(chatId, { text: errorMessage });
                }
            }
        }
    } catch (error) {
        console.error("pairCommand error:", error);
        await sock.sendMessage(chatId, {
            text: "⚠️ An error occurred. Please try again later."
        });
    }
}

module.exports = pairCommand;
