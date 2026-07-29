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
                const response = await axios.get(`http://localhost:${port}/pair?number=${number}`, {
                    timeout: 30000
                });
                console.log("Local API response:", response.data);

                if (response.data && response.data.code) {
                    const code = response.data.code;
                    if (code === "Service Unavailable") {
                        throw new Error('Service Unavailable');
                    }

                    await sleep(1000);
                    await sock.sendMessage(chatId, {
                        text: `✅ *Pairing Code:*\n\n\`${code}\`\n\n📱 Open WhatsApp > Linked Devices > Link a Device\n🔢 Enter the code above\n\n> 𝗠𝗔𝗡𝗜 𝗠𝗗 ☘`
                    }, { quoted: message });
                } else {
                    throw new Error('Invalid response from server');
                }
            } catch (apiError) {
                console.error('Local API Error:', apiError.message);
                // Fallback: use manual pairing method
                try {
                    const { utils } = require('@whiskeysockets/baileys');
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
