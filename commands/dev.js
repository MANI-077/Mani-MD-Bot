// commands/dev.js
async function devCommand(sock, chatId, message, q) {
  try {
    const senderJid = message.key?.participant || message.key?.remoteJid || message.sender || '';
    const pushname =
      message.pushName ||
      message.message?.pushName ||
      (senderJid ? senderJid.split('@')[0] : 'there');

    const name = pushname || 'there';

    const caption = `
╭─⌈ *👨‍💻 ᴍᴀɴɪ ᴍᴅ ⚚ ʙᴏᴛ ᴅᴇᴠᴇʟᴏᴘᴇʀ* ⌋─
│
│ 👋 Hello, *${name}*!
│
│ 🤖 I'm *ᴍᴀɴɪ xᴛᴇᴄʜ ☘*, the creator and
│    maintainer of this smart WhatsApp bot.
│
│ 👨‍💻 *ᴅᴇᴠ ɪɴꜰᴏ:*
│ ──────────
│ 🧠 *Name:* ᴍᴀɴɪ xᴛᴇᴄʜ
│ 🎂 *Age:* +20
│ 📞 *Contact:* wa.me/9779807044421
│ 
│
│
╰─────────

>⚡Powered By ᴍᴀɴɪ ᴍᴅ ☘
    `.trim();

    const contextInfo = {
      mentionedJid: senderJid ? [senderJid] : [],
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363429143452524@newsletter",
        newsletterName: "🪀『 ᴍᴀɴɪ ᴍᴅ ☘』🪀",
        serverMessageId: 143
      },
      externalAdReply: {
        title: "ᴍᴀɴɪ ᴍᴅ ☘",
        body: "Created with ❤️ by ᴍᴀɴɪ xᴛᴇᴄʜ",
        thumbnailUrl: "https://qu.ax/Mj4Mx",
        mediaType: 1,
        renderSmallerThumbnail: true,
        showAdAttribution: true,
        mediaUrl: "",
        sourceUrl: ""
      }
    };

    await sock.sendMessage(
      chatId,
      {
        image: { url: "https://qu.ax/Mj4Mx" },
        caption,
        contextInfo
      },
      { quoted: message }
    );
  } catch (err) {
    console.error("devCommand error:", err);
    await sock.sendMessage(chatId, { text: `❌ Error showing dev info: ${err.message}` }, { quoted: message });
  }
}

module.exports = devCommand;
