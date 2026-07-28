const settings = require('../../settings');
const path = require('path');
const fs = require('fs');

const imagePath = path.join(__dirname, '../../assets/bot_image.jpg');

module.exports = async (sock, chatId, message) => {
    const caption = `
╭═✦〔 ✅ *ꜱᴇʟᴇᴄᴛᴇᴅ* ✅ 〕✦═╮
│🛠️ ᴘʀᴇғɪx  : [ ${settings.prefix} ]
│🚀 ᴠᴇʀsɪᴏɴ : *${settings.version}*
╰═══⭘════════════⚬═╯
 
╭═✦〔 🎨 *ɪᴍɢ/ꜱᴛᴋʀ ᴄᴍᴅꜱ* 〕✦═╮
│
│❏ .blur <image>
│❏ .simage <reply to sticker>
│❏ .sticker <reply to image>
│❏ .removebg
│❏ .remini
│❏ .crop <reply to image>
│❏ .tgsticker <Link>
│❏ .meme
│❏ .take <packname> 
│❏ .emojimix <emj1>+<emj2>
│❏ .igs <insta link>
│❏ .igsc <insta link>
│
╰═✪╾✦═✦═✦═✦═✦╼✪═╯
> ${settings.caption}
`;

    let imageBuffer = null;
    if (fs.existsSync(imagePath)) {
        imageBuffer = fs.readFileSync(imagePath);
    }

    await sock.sendMessage(chatId, {
        ...(imageBuffer ? { image: imageBuffer } : {}),
        caption,
        contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363429143452524@newsletter',
                newsletterName: 'ᴍᴀɴɪ ᴍᴅ ☘',
                serverMessageId: -1
            }
        }
    }, { quoted: message });

    await sock.sendMessage(chatId, {
        react: { text: '📂', key: message.key }
    });
};
