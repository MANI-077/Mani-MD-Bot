const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SESSION_PATH = path.join(__dirname, '../session/creds.json');
const SESSION_ID = process.env.SESSION_ID || 'default';
const GIST_DESCRIPTION = `Mani-MD-Bot-Session-${SESSION_ID}`;

async function getGistId() {
    try {
        if (!GITHUB_TOKEN) return null;
        const res = await axios.get('https://api.github.com/gists?per_page=100', {
            headers: { 
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!Array.isArray(res.data)) return null;
        
        const gist = res.data.find(g => g.description === GIST_DESCRIPTION);
        return gist ? gist.id : null;
    } catch (e) {
        console.error('❌ [SESSION-SYNC] Error getting Gist ID:', e.response?.data?.message || e.message);
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
        if (!GITHUB_TOKEN) {
            console.log('⚠️ [SESSION-SYNC] GITHUB_TOKEN not set, skipping upload.');
            return;
        }
        if (!fs.existsSync(SESSION_PATH)) return;
        const content = fs.readFileSync(SESSION_PATH, 'utf8');
        
        // Basic validation: ensure it's valid JSON and contains necessary keys
        try {
            const parsed = JSON.parse(content);
            if (!parsed.creds || !parsed.creds.noiseKey) {
                console.log('⚠️ [SESSION-SYNC] Incomplete creds.json, skipping upload.');
                return;
            }
        } catch (e) {
            console.error('❌ [SESSION-SYNC] Invalid JSON in creds.json:', e.message);
            return;
        }

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
                headers: { 
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            console.log(`✅ [SESSION-SYNC] Session updated on GitHub (Gist: ${gistId})`);
        } else {
            const res = await axios.post('https://api.github.com/gists', data, {
                headers: { 
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            console.log(`✅ [SESSION-SYNC] New session created on GitHub (Gist: ${res.data.id})`);
        }
    } catch (e) {
        console.error('❌ [SESSION-SYNC] Error uploading session:', e.message);
    }
}

module.exports = { downloadSession, uploadSession };
