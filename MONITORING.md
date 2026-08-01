# 🛡️ Mani-MD-Bot Monitoring Guide

To keep your bot online **24/7** on Render's Free Tier, follow these three steps.

## 1. GitHub Actions Monitor (Internal)
I have already set up a GitHub Action that pings your bot every **5 minutes**. 
- Go to your GitHub Repo -> **Actions** tab.
- Ensure the **"Bot Keep-Alive & Maintenance"** workflow is enabled.
- **IMPORTANT:** Go to Settings -> Secrets and variables -> Actions and add a secret named `RENDER_EXTERNAL_URL` with your bot's URL (e.g., `https://your-bot.onrender.com`).

## 2. UptimeRobot (External - MOST RELIABLE)
This is the industry standard for keeping Render apps awake.
1. Create a free account at [UptimeRobot.com](https://uptimerobot.com/).
2. Click **"Add New Monitor"**.
3. **Monitor Type:** HTTP(s).
4. **Friendly Name:** Mani-MD-Bot.
5. **URL:** `https://your-bot.onrender.com/ping` (Replace with your actual URL).
6. **Monitoring Interval:** Every 5 minutes.
7. Click **Create Monitor**.

## 3. Render Environment Variables
Ensure these are set in your Render Dashboard (Settings -> Environment):
- `RENDER_EXTERNAL_URL`: `https://your-bot.onrender.com`
- `GITHUB_TOKEN`: Your GitHub Access Token.
- `SESSION_ID`: Your session identifier.

---
> By using both **GitHub Actions** and **UptimeRobot**, your bot will stay awake even if one service fails! 🚀
