const axios = require('axios');
const yts = require('yt-search');

const REPLY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function videoCommand(sock, chatId, message) {
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

        // Strip prefix and command name (.video, .ytmp4)
        const withoutCmd = rawText.replace(/^\s*[.\/!](?:video|ytmp4)\b/i, "").trim();
        const searchQuery = withoutCmd || quoted || "";

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: "🎥 *Usage:* `.video <video name or YouTube URL>`\n💡 Example: `.video Despacito`"
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: "_🎬 Searching for your video..._" }, { quoted: message });

        // 🔎 Search YouTube
        const search = await yts(searchQuery);
        if (!search.videos || !search.videos.length) {
            return await sock.sendMessage(chatId,
                { text: "❌ No results found for: " + searchQuery },
                { quoted: message });
        }

        const video = search.videos[0];
        const videoUrl = video.url;
        let videoData = null;

        // --- Multi-API fallback (Izumi → Violetics → EliteProTech) ---
        try {
            // 1️⃣ Izumi API
            const izumiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(videoUrl)}&format=720`;
            const res = await axios.get(izumiUrl, { timeout: 25000 });
            if (res.data?.result?.download) {
                videoData = {
                    title: res.data.result.title,
                    download: res.data.result.download
                };
            }
        } catch (err) {
            console.log("Izumi API failed:", err.message);
        }

        if (!videoData) {
            // 2️⃣ Violetics API (Fallback for video)
            try {
                const violeticsUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`;
                const res = await axios.get(violeticsUrl, { timeout: 25000 });
                if (res.data?.result?.download_url) {
                    videoData = {
                        title: res.data.result.title,
                        download: res.data.result.download_url
                    };
                }
            } catch (err) {
                console.log("Violetics API failed:", err.message);
            }
        }

        if (!videoData) {
            // 3️⃣ EliteProTech API (Fallback)
            try {
                const api = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(videoUrl)}&format=mp4`;
                videoData = {
                    title: video.title,
                    download: api
                };
            } catch (err) {
                console.log("EliteProTech API failed:", err.message);
            }
        }

        if (!videoData) {
            return await sock.sendMessage(chatId, { text: "❌ Failed to get download link. Please try again later." }, { quoted: message });
        }

        const videoCaption =
            `╭───『 🎬 *ᴠɪᴅᴇᴏ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ* 』──\n` +
            `│ 📀 *Title:* ${video.title}\n` +
            `│ ⏱️ *Duration:* ${video.timestamp}\n` +
            `│ 👁️ *Views:* ${video.views?.toLocaleString()}\n` +
            `│ 🌍 *Published:* ${video.ago}\n` +
            `│ 👤 *Author:* ${video.author?.name}\n` +
            `│ 🔗 *URL:* ${videoUrl}\n` +
            `╰───────────────╯\n\n` +
            `╭───⌯ Choose Type ⌯───\n` +
            `│ 1️⃣ 🎬 Video\n` +
            `│ 2️⃣ 📁 Document\n` +
            `╰───────────────╯\n` +
            `> Powered by ᴍᴀɴɪ ᴍᴅ ☘`;

        const sentMsg = await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: videoCaption
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
                    { text: "⏳ Downloading video..." },
                    { quoted: reply });

                const fileName = `${video.title.replace(/[<>:"/\\|?*]+/g, '')}.mp4`;

                if (body.trim() === "1") {
                    await sock.sendMessage(chatId, {
                        video: { url: videoData.download },
                        mimetype: "video/mp4",
                        fileName: fileName,
                        caption: `▶️ *Now Playing:* ${video.title}`
                    }, { quoted: reply });
                } else {
                    await sock.sendMessage(chatId, {
                        document: { url: videoData.download },
                        mimetype: "video/mp4",
                        fileName: fileName,
                        caption: `💾 *Saved:* ${video.title}`
                    }, { quoted: reply });
                }
                
                // React with success
                await sock.sendMessage(chatId, { react: { text: '✅', key: reply.key } });

            } catch (err) {
                console.error("Video reply handler error:", err);
            }
        };

        sock.ev.on("messages.upsert", listener);
        const timeout = setTimeout(() => {
            sock.ev.off("messages.upsert", listener);
        }, REPLY_TIMEOUT_MS);

    } catch (err) {
        console.error(err);
        await sock.sendMessage(chatId,
            { text: "❌ An error occurred while processing the video request." },
            { quoted: message });
    }
}

module.exports = videoCommand;
