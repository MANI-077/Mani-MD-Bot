# 🛡️ Mani-MD-Bot Monitoring Guide

To keep your bot online **24/7** on Render's Free Tier, follow these steps.

## 1. UptimeRobot (Primary - MANDATORY)
This is the **ONLY** way to guarantee 24/7 uptime on Render Free Tier.
1. Create a free account at [UptimeRobot.com](https://uptimerobot.com/).
2. Click **"Add New Monitor"**.
3. **Monitor Type:** HTTP(s).
4. **Friendly Name:** Mani-MD-Bot.
5. **URL:** `https://your-bot.onrender.com/ping` (Replace with your actual Render URL).
6. **Monitoring Interval:** Every 5 minutes.
7. Click **Create Monitor**.

## 2. GitHub Actions Monitor (Secondary)
I have set up a GitHub Action that pings your bot every **5 minutes**. 
- **Limitation:** GitHub Actions "Schedule" can be delayed by 15-30 minutes on free accounts. This is why the bot might still go offline.
- **How to fix:** Ensure the **"Bot Keep-Alive & Maintenance"** workflow is enabled in your **Actions** tab.
- **IMPORTANT:** Add a Secret named `RENDER_EXTERNAL_URL` in your GitHub Settings.

## 3. Render Environment Variables
Ensure these are set in your Render Dashboard (Settings -> Environment):
- `RENDER_EXTERNAL_URL`: `https://your-bot.onrender.com`
- `GITHUB_TOKEN`: Your GitHub Access Token.
- `SESSION_ID`: A unique name for your session (e.g., `mani-session-1`).

---
> **Note:** Without UptimeRobot, Render will turn off your bot after 15 minutes of no activity. GitHub Actions is not fast enough to prevent this. 🚀
