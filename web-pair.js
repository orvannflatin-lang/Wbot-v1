import express from 'express';
import cors from 'cors';
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import { uploadSessionToSupabase } from './src/utils/supabase-session.js';
import { encodeSession } from './src/utils/session-handler.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('web'));

const BOT_CONFIG = {
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    printQRInTerminal: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000
};

let activePairings = new Map();

async function startPairing(phoneNumber) {
    const sessionId = `pair-${Date.now()}`;
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_pairing');

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }),
        ...BOT_CONFIG
    });

    const pairingData = {
        sock,
        phoneNumber,
        code: null,
        connected: false,
        sessionId: null
    };

    activePairings.set(sessionId, pairingData);

    // Request pairing code FIRST
    if (!sock.authState.creds.registered) {
        console.log('\n⏳ Demande code pairing...');
        await delay(2000);
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`✅ Code généré: ${code}`);
        pairingData.code = code;
    }

    // THEN attach listeners
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Fermé. Code: ${reason}`);
            pairingData.connected = false;
        }

        if (connection === 'open') {
            console.log('✅ CONNEXION RÉUSSIE !');
            pairingData.connected = true;

            try {
                const shortId = await uploadSessionToSupabase('./auth_info_pairing');
                pairingData.sessionId = shortId;
                console.log(`Session ID: ${shortId}`);
            } catch (err) {
                pairingData.sessionId = encodeSession('./auth_info_pairing');
            }

            // Optionally send messages
            const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await sock.sendMessage(myJid, { text: `✅ SESSION_ID=${pairingData.sessionId}` });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    return sessionId;
}

app.post('/api/pair', async (req, res) => {
    const { phoneNumber } = req.body;

    // Clean old session
    if (fs.existsSync('./auth_info_pairing')) {
        fs.rmSync('./auth_info_pairing', { recursive: true, force: true });
    }

    try {
        const sessionId = await startPairing(phoneNumber);
        const data = activePairings.get(sessionId);

        res.json({
            success: true,
            code: data.code,
            sessionId: sessionId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pair-status/:sessionId', (req, res) => {
    const data = activePairings.get(req.params.sessionId);
    if (!data) return res.status(404).json({ error: 'Not found' });

    res.json({
        connected: data.connected,
        code: data.code,
        sessionId: data.sessionId
    });
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'web' });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🌐 Web Pairing Server on http://localhost:${PORT}`);
});
