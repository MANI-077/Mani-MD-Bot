#!/bin/bash
# ==========================================
# ᴍᴀɴɪ 𝗠𝗗 ☘ - Update Commands & Deploy
# ==========================================
# This script:
# 1. Stages and commits all changes
# 2. Pushes to GitHub
# 3. Triggers Render deploy hook

echo "╭═══════════════════════════════════════╮"
echo "│  ᴍᴀɴɪ 𝗠𝗗 ☘ - Update & Deploy          │"
echo "╰═══════════════════════════════════════╯"
echo ""

# Stage all changes
echo "📦 Staging changes..."
git add -A

# Commit
echo "📝 Committing changes..."
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
git commit -m "🚀 Update: Auto-chat, fixed auto-react, pairing notifications, deploy hook ($TIMESTAMP)"

# Push
echo "📤 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Pushed successfully!"
echo ""
echo "🔄 Triggering Render deploy..."
echo ""

# Trigger Render deploy
RENDER_DEPLOY_HOOK="https://api.render.com/deploy/srv-d9kc8q3tqb8s73b88dvg?key=svdYViZ5-dk"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$RENDER_DEPLOY_HOOK")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
    echo "✅ Render deploy triggered successfully! (HTTP $HTTP_CODE)"
    echo "🔄 Your bot will be live in 1-3 minutes."
else
    echo "⚠️ Render deploy hook returned HTTP $HTTP_CODE"
    echo "   Bot may auto-deploy from GitHub push (autoDeploy: true)"
fi

echo ""
echo "═══════════════════════════════════════"
echo "Done! Bot is being updated."
echo "═══════════════════════════════════════"
