// ============================================================
// COMMAND: csong
// 𝗠𝗔𝗡𝗜 𝗠𝗗 ☘ - command/csong.js
// Channel Song Forwarder - Downloads & sends songs to a channel
// ============================================================

module.exports = {
    name: "csong",
    aliases: ["cs"],
    async execute({ conn, mek, m, from, sender, isOwner, isGroup, reply, quoted, q, args, body, pushname, botNumber, ownerNumber, readEnvSync, adhiqmini, GQCAP, prefix, runtime, os }) {

    try {
        const axios   = require('axios');
        const yts     = require('yt-search');
        const fs      = require('fs');
        const path    = require('path');
        const { ytmp3 } = require('ruhend-scraper');

        // ── Usage check ─────────────────────────────────────────────
        if (!args || args.length < 2) {
            return reply(
                `❌ *Usage:*\n\n` +
                `*.csong <channel_jid> <song name>*\n\n` +
                `Example:\n` +
                `*.csong 120363424190766692@newsletter Shape of You*`
            );
        }

        const channelJid = args[0];
        const songQuery  = args.slice(1).join(' ');

        if (!channelJid.endsWith('@newsletter')) {
            return reply(`❌ Invalid channel JID!\n\nChannel JID must end with *@newsletter*\n\nExample: \`120363424190766692@newsletter\``);
        }

        if (!songQuery) {
            return reply(`❌ Please provide a song name!\n\nExample:\n*.csong 120363424190766692@newsletter Shape of You*`);
        }

        await reply(`🔍 *Searching...*\n\n*${songQuery}*\n\nPlease wait...`);

        // ── YouTube Search ──────────────────────────────────────────
        const searchResult = await yts(songQuery);
        if (!searchResult.videos.length) {
            return reply(`❌ No results found!\n\nප්‍රතිඵල හමු නොවිණි!`);
        }

        const video    = searchResult.videos[0];
        const videoUrl = video.url;
        const title    = video.title;
        const duration = video.timestamp;
        const thumbnail= video.thumbnail;
        const views    = video.views;
        const author   = video.author?.name || 'Unknown';
        const ago      = video.ago || '';

        // ── Multi-API fallback system ────────
        let downloadUrl = null;
        
        const apis = [
            // 1. Ruhend-Scraper
            async () => {
                const res = await ytmp3(videoUrl);
                return res && res.audio ? res.audio : null;
            },
            // 2. GiftedTech API
            async () => {
                const res = await axios.get(`https://api.giftedtech.my.id/api/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                return res.data?.result?.download_url || null;
            },
            // 3. Siputzx API
            async () => {
                const res = await axios.get(`https://api.siputzx.my.id/api/dwnld/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                return res.data?.data?.dl || null;
            },
            // 4. Vreden API
            async () => {
                const res = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                return res.data?.result?.download?.url || null;
            },
            // 5. Izumi API
            async () => {
                const res = await axios.get(`https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(videoUrl)}&format=mp3`, { timeout: 15000 });
                return res.data?.result?.download || null;
            }
        ];

        for (const api of apis) {
            try {
                const url = await api();
                if (url) {
                    downloadUrl = url;
                    break;
                }
            } catch (err) {
                console.log('[csong] API fallback failed:', err.message);
            }
        }

        if (!downloadUrl) {
            return reply(`❌ Download link not found after trying multiple APIs!\n\nDownload link හමු නොවිණි!`);
        }

        await reply(`✅ *Found! Sending to channel...*\n\nකරුණාකර රැඳෙන්න... 🎵`);

        // ── Download main MP3 ───────────────────────────────────────
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const unique = Date.now();
        const mp3Path = path.join(tempDir, `csong_${unique}.mp3`);

        const audioResponse = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        fs.writeFileSync(mp3Path, Buffer.from(audioResponse.data));

        // ── Channel message ─────────────────────────────────────────
        const cuteMsg =
`🌸 𝑵𝒐𝒘 𝑷𝒍𝒂𝒚𝒊𝒏𝒈 🌸

🎶 𝑻𝒊𝒕𝒍𝒆 : ${title}

⏱ 𝑫𝒖𝒓𝒂𝒕𝒊𝒐𝒏 : ${duration || 'Unknown'}
👁 𝑽𝒊𝒆𝒘𝒔 : ${views ? views.toLocaleString() : 'Unknown'}
👤 𝑪𝒉𝒂𝒏𝒏𝒆𝒍 : ${author}
🕒 𝑼𝒑𝒍𝒐𝒂𝒅𝒆𝒅 : ${ago}

🔗 ${videoUrl}

✨ 𝐅𝐧𝐣𝐨𝐲 𝐲𝐨𝐮𝐫 𝐦𝐮𝐬𝐢𝐜 🎧`;

        // ── Send thumbnail + caption to channel ─────────────────────
        if (thumbnail) {
            await conn.sendMessage(channelJid, {
                image: { url: thumbnail },
                caption: cuteMsg
            });
        } else {
            await conn.sendMessage(channelJid, {
                text: cuteMsg
            });
        }

        // ── Send audio to channel ──────────────────────────────
        await conn.sendMessage(channelJid, {
            audio: fs.readFileSync(mp3Path),
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `${title}.mp3`
        });

        // ── Cleanup ─────────────────────────────────────────────────
        try { if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path); } catch (e) {}

        // ── React + confirm ─────────────────────────────────────────
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        reply(
            `✅ *Successfully sent to channel!*\n\n` +
            `🎵 *${title}*\n` +
            `📢 *Channel:* \`${channelJid}\`\n\n` +
            `_Channel ekata song eka successfully send una!_ 🎉`
        );

    } catch (e) {
        console.error('[csong] Error:', e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });

        let errorMsg = "⚠️ *Error occurred!*\n\nවැරැද්දක් සිදු වුනා!\n\n";
        if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
            errorMsg += "⏱️ Request timeout. Try again!\nකාලය ඉක්මවා ගියා!";
        } else {
            errorMsg += `❌ ${e.message || 'Please try again later.'}\nපසුව උත්සාහ කරන්න.`;
        }
        reply(errorMsg);
    }

    }
};
