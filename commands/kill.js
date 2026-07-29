// commands/kill.js - FUN COMMAND (Public)

module.exports = async (sock, chatId, message) => {
  try {
    const body =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      "";

    const args = body.split(" ").slice(1);
    const target = args[0] || "unknown";

    const replyMsg = 
`🔫 *𝗠𝗔𝗡𝗜 𝗠𝗗 ☘* 🔫

💀 Target: *${target}*
✅ *DESTROYED SUCCESSFULLY!*

⚡ *ᴍᴀɴɪ ᴍᴅ ☘* has eliminated the target!
🎯 Mission Complete!

> 𝗠𝗔𝗡𝗜 𝗠𝗗 ☘`;

    await sock.sendMessage(
      chatId,
      {
        text: replyMsg,
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: '120363429143452524@newsletter',
            newsletterName: '𝗠𝗔𝗡𝗜 𝗠𝗗 ☘',
            serverMessageId: -1
          }
        }
      },
      { quoted: message }
    );

    await sock.sendMessage(chatId, { react: { text: "💀", key: message.key } });

  } catch (err) {
    console.error("Kill command error:", err);
    await sock.sendMessage(chatId, { text: "⚠️ Something went wrong." }, { quoted: message });
  }
};
