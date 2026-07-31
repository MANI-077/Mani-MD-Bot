const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SESSION_PATH = path.join(__dirname, '../session/creds.json');
const GIST_DESCRIPTION = 'Mani-MD-Bot-Session';

async function getGistId() {
    try {
        const res = await axios.get('https://api.github.com/gists', {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        const gist = res.data.find(g => g.description === GIST_DESCRIPTION);
        return gist ? gist.id : null;
    } catch (e) {
        console.error('❌ [SESSION-SYNC] Error getting Gist ID:', e.message);
        return null;
    }
}

async function downloadSession() {
    try {
        const gistId = await getGistId();
        if (!gistId) {
            console.log('ℹ️ [SESSION-SYNC] No existing session found on GitHub.');
            return false;
        }

        const res = await axios.get(`https://api.github.com/gists/${gistId}`, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });

        const content = res.data.files['creds.json'].content;
        if (!fs.existsSync(path.dirname(SESSION_PATH))) {
            fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
        }
        fs.writeFileSync(SESSION_PATH, content);
        console.log('✅ [SESSION-SYNC] Session downloaded and restored from GitHub.');
        return true;
    } catch (e) {
        console.error('❌ [SESSION-SYNC] Error downloading session:', e.message);
        return false;
    }
}

async function uploadSession() {
    try {
        if (!fs.existsSync(SESSION_PATH)) return;
        const content = fs.readFileSync(SESSION_PATH, 'utf8');
        const gistId = await getGistId();

        const data = {
            description: GIST_DESCRIPTION,
            public: false,
            files: {
                'creds.json': { content }
            }
        };

        if (gistId) {
            await axios.patch(`https://api.github.com/gists/${gistId}`, data, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` }
            });
            console.log('✅ [SESSION-SYNC] Session updated on GitHub.');
        } else {
            await axios.post('https://api.github.com/gists', data, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` }
            });
            console.log('✅ [SESSION-SYNC] New session created on GitHub.');
        }
    } catch (e) {
        console.error('❌ [SESSION-SYNC] Error uploading session:', e.message);
    }
}

module.exports = { downloadSession, uploadSession };
