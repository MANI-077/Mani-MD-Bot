#!/bin/bash
# ==========================================
# ᴍᴀɴɪ 𝗠𝗗 ☘ - Render Deploy Hook
# ==========================================
# This script triggers the Render deploy hook to redeploy the bot
# Usage: ./render-deploy-hook.sh

RENDER_DEPLOY_HOOK="https://api.render.com/deploy/srv-d9kc8q3tqb8s73b88dvg?key=svdYViZ5-dk"

echo "╭═══════════════════════════════════════╮"
echo "│  ᴍᴀɴɪ 𝗠𝗗 ☘ - Render Deploy Hook      │"
echo "╰═══════════════════════════════════════╯"
echo ""
echo "📡 Triggering Render deploy hook..."
echo "🔗 Service: srv-d9kc8q3tqb8s73b88dvg"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$RENDER_DEPLOY_HOOK")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
    echo "✅ Deploy triggered successfully! (HTTP $HTTP_CODE)"
    echo "🔄 Your bot is now being redeployed on Render..."
    echo "⏳ It may take 1-3 minutes to go live."
    echo ""
    echo "Check your Render dashboard:"
    echo "https://dashboard.render.com"
else
    echo "⚠️ Deploy hook returned HTTP $HTTP_CODE"
    echo "Response: $BODY"
    echo ""
    echo "The bot may auto-deploy from GitHub push."
fi

echo ""
echo "═══════════════════════════════════════"
echo "Done!"
echo "═══════════════════════════════════════"
