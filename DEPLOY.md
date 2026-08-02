# ᴍᴀɴɪ 𝗠𝗗 ☘ - Deploy Guide

## Render Deployment

### Environment Variables (Set in Render Dashboard)
| Key | Value |
|-----|-------|
| `PORT` | `10000` |
| `RENDER_EXTERNAL_URL` | `https://your-app-name.onrender.com` |
| `GITHUB_TOKEN` | Your GitHub personal access token |
| `DEPLOY_HOOK_KEY` | `svdYViZ5-dk` |

### Deploy Hook
Trigger a manual deploy:
```bash
curl -X POST "https://api.render.com/deploy/srv-d9kc8q3tqb8s73b88dvg?key=svdYViZ5-dk"
```

Or use the included script:
```bash
./render-deploy-hook.sh
```

### Push & Auto-Deploy
```bash
./update-commands.sh
```
This will commit, push to GitHub, and trigger Render deploy.

---

## New Commands (v3.0.1+)

### Auto-Chat (`💬`)
Auto-responds to **all** messages without needing mentions or replies.
- `.autochat on` - Enable auto-chat for current group
- `.autochat off` - Disable auto-chat for current group
- `.autochat status` - Check status

### Auto-React (`🎭`)
Reacts with random emojis to all incoming messages.
- `.autoreact on` - Enable globally
- `.autoreact off` - Disable globally
- `.areact on` - Same as above (alias)
- `.areact off` - Same as above (alias)
- `.autoreaction on/off` - Same as above (alias)

### Pair Device
Visit `https://your-app.onrender.com/` to pair your WhatsApp device.
After successful pairing, you'll see a notification on the web interface.

---

## Pairing Notification Fix
The web interface now shows a toast notification when device pairing is successful.
It listens for the `connection-status` Socket.IO event and displays:
- ✅ "Device Paired Successfully!" notification
- Updates Session status to "Connected"
- Updates Connection status to "Stable"
- Updates Bot Status to "Online"
