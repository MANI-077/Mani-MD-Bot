#!/bin/bash
# ==========================================
# ᴍᴀɴɪ 𝗠𝗗 ☘ - Render Deploy Hook Script
# ==========================================
# Usage: ./deploy.sh
# This script triggers the Render deploy hook to redeploy the bot

RENDER_DEPLOY_HOOK="https://api.render.com/deploy/srv-d9kc8q3tqb8s73b88dvg?key=svdYViZ5-dk"

echo "╭═══════════════════════════════════════╮"
echo "│  ᴍᴀɴɪ 𝗠𝗗 ☘ - Deploy to Render        │"
echo "╰═══════════════════════════════════════╯"

echo ""
echo "📡 Triggering Render deploy hook..."
echo "🔗 Hook URL: $RENDER_DEPLOY_HOOK"
echo ""

# Trigger the deploy hook
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$RENDER_DEPLOY_HOOK")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
    echo "✅ Deploy triggered successfully! (HTTP $HTTP_CODE)"
    echo "🔄 Your bot is now being redeployed on Render..."
    echo "⏳ It may take 1-3 minutes to go live."
else
    echo "❌ Deploy failed with HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi

echo ""
echo "═══════════════════════════════════════"
echo "Done! Check your Render dashboard for build logs."
echo "═══════════════════════════════════════"
