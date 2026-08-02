const yts = require("yt-search");
const { ytmp3 } = require("ruhend-scraper");
const axios = require("axios");

const REPLY_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

async function songCommand(sock, chatId, message) {
    try {
        const rawText =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            "";

        const quoted =
            message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
            message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
            "";

        // Strip prefix and command name (.song, .mp3, .ytmp3)
        const withoutCmd = rawText.replace(/^\s*[.\/!](?:song|mp3|ytmp3)\b/i, "").trim();
        const searchQuery = withoutCmd || quoted || "";

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: "🎵 *Usage:* `.song <song name or YouTube URL>`\n💡 Example: `.song Faded`"
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: "_🎶 Searching for your song..._" }, { quoted: message });

        // 🔎 Search YouTube
        const search = await yts(searchQuery);
        if (!search.videos || !search.videos.length) {
            return await sock.sendMessage(chatId,
                { text: "❌ No results found for: " + searchQuery },
                { quoted: message });
        }

        const video = search.videos[0];
        const videoUrl = video.url;
        let songData = null;

        // --- Multi-API fallback system ---
        const apis = [
            // 1. Ruhend-Scraper
            async () => {
                const res = await ytmp3(videoUrl);
                return res && res.audio ? { download: res.audio } : null;
            },
            // 2. GiftedTech API
            async () => {
                const res = await axios.get(`https://api.giftedtech.my.id/api/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                return res.data?.result?.download_url ? { download: res.data.result.download_url } : null;
            },
            // 3. Siputzx API
            async () => {
                const res = await axios.get(`https://api.siputzx.my.id/api/dwnld/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                return res.data?.data?.dl ? { download: res.data.data.dl } : null;
            },
            // 4. Vreden API
            async () => {
                const res = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                return res.data?.result?.download?.url ? { download: res.data.result.download.url } : null;
            },
            // 5. Izumi API
            async () => {
                const res = await axios.get(`https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(videoUrl)}&format=mp3`, { timeout: 15000 });
                return res.data?.result?.download ? { download: res.data.result.download } : null;
            }
        ];

        for (const api of apis) {
            try {
                const data = await api();
                if (data && data.download) {
                    songData = data;
                    break;
                }
            } catch (err) {
                console.log("API fallback failed:", err.message);
            }
        }

        if (!songData) {
            return await sock.sendMessage(chatId, { text: "❌ Download link not found after trying multiple APIs! Please try a different song or try again later." }, { quoted: message });
        }

        const songInfo =
            `╭───『 🎧 *ꜱᴏɴɢ ɪɴꜰᴏ* 』──\n` +
            `│ 📀 *Title:* ${video.title}\n` +
            `│ ⏱️ *Duration:* ${video.timestamp}\n` +
            `│ 👁️ *Views:* ${video.views?.toLocaleString()}\n` +
            `│ 🌍 *Published:* ${video.ago}\n` +
            `│ 👤 *Author:* ${video.author?.name}\n` +
            `│ 🔗 *URL:* ${videoUrl}\n` +
            `╰───────────────╯\n\n` +
            `╭───⌯ Choose Type ⌯───\n` +
            `│ 1️⃣ 🎵 Audio\n` +
            `│ 2️⃣ 📁 Document\n` +
            `╰───────────────╯\n` +
            `> Powered by ᴍᴀɴɪ ᴍᴅ ☘`;

        const sentMsg = await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: songInfo
        }, { quoted: message });

        const listener = async ({ messages }) => {
            try {
                const reply = messages[0];
                const body =
                    reply.message?.conversation ||
                    reply.message?.extendedTextMessage?.text;

                if (!body) return;

                const isReply =
                    reply.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

                if (!["1", "2"].includes(body.trim()) || !isReply) return;

                clearTimeout(timeout);
                sock.ev.off("messages.upsert", listener);

                await sock.sendMessage(chatId,
                    { text: "⏳ Downloading audio..." },
                    { quoted: reply });

                const fileName = `${video.title.replace(/[<>:"/\\|?*]+/g, '')}.mp3`;

                const audioBuffer = await axios.get(songData.download, { responseType: 'arraybuffer' }).then(res => Buffer.from(res.data));

                if (body.trim() === "1") {
                    await sock.sendMessage(chatId, {
                        audio: audioBuffer,
                        mimetype: "audio/mpeg",
                        fileName: fileName
                    }, { quoted: reply });
                } else {
                    await sock.sendMessage(chatId, {
                        document: audioBuffer,
                        mimetype: "audio/mpeg",
                        fileName: fileName
                    }, { quoted: reply });
                }
                
                // React with success
                await sock.sendMessage(chatId, { react: { text: '✅', key: reply.key } });

            } catch (err) {
                console.error("Song reply handler error:", err);
                await sock.sendMessage(chatId, { text: "❌ Failed to send audio. The download link might have expired." }, { quoted: sentMsg });
            }
        };

        sock.ev.on("messages.upsert", listener);
        const timeout = setTimeout(() => {
            sock.ev.off("messages.upsert", listener);
        }, REPLY_TIMEOUT_MS);

    } catch (err) {
        console.error(err);
        await sock.sendMessage(chatId,
            { text: "❌ An error occurred while processing the song request." },
            { quoted: message });
    }
}

module.exports = songCommand;
