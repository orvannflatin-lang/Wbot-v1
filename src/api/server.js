import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encodeSession, generateSessionId } from '../utils/session-handler.js';
import { uploadSessionToSupabase } from '../utils/supabase-session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS configuré pour accepter les requêtes de Netlify
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://wbotv1.netlify.app',  // URL Netlify de production
    /\.netlify\.app$/  // Permet tous les sous-domaines Netlify
];

app.use(cors({
    origin: function (origin, callback) {
        // Permettre les requêtes sans origin (ex: Postman, curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) return allowed.test(origin);
            return allowed === origin;
        })) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// Serve static files from web folder
app.use(express.static(path.join(__dirname, '../../web')));

// Store active connection sessions
const activeSessions = new Map();

/**
 * Request pairing code for a phone number
 */
app.post('/api/request-pairing', async (req, res) => {
    try {
        const { phoneNumber, method } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Generate unique session ID
        const tempSessionId = generateSessionId();
        const authFolder = `./temp_sessions/${tempSessionId}`;

        // 🔧 FIX: Declare variables at function scope
        let qrCodeData = null;
        let qrImageData = null;
        let pairingCode = null;

        // Promise to wait for QR or Code
        let responseSent = false;

        // 🔧 FIX: Clean session folder robustly (like connect-fix.js)
        if (fs.existsSync(authFolder)) {
            fs.rmSync(authFolder, { recursive: true, force: true });
            console.log('🧹 Session cleaned:', authFolder);
        }

        // Create auth state
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);

        // Create socket
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            // 🔧 FIX: Logique "AMDA" / "OVL" (Signature Array explicite + Timeouts longs)
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            printQRInTerminal: true,
            mobile: false,
            // OVL Params
            syncFullHistory: true, // OVL met true finalement
            markOnlineOnConnect: true, // Important pour être "vu"
            generateHighQualityLinkPreview: true,
            receivedPendingNotifications: true, // OVL specific
            connectTimeoutMs: 150000, // 150s (OVL)
            defaultQueryTimeoutMs: 150000,
            keepAliveIntervalMs: 10000,
            retryRequestDelayMs: 5000
        });

        // Store session early
        activeSessions.set(tempSessionId, {
            phoneNumber,
            connected: false,
            code: null,
            qr: null,
            qrImage: null,
            sessionId: null
        });

        return new Promise(async (resolve, reject) => {
            // Timeout safety (Extended for Render)
            const timeout = setTimeout(() => {
                if (!responseSent) {
                    responseSent = true;
                    // Send whatever we have or error
                    res.status(504).json({ error: 'Timeout waiting for WhatsApp code (Render is slow, please retry)' });
                    resolve();
                }
            }, 60000); // 60s timeout (Render Free Tier needs more time)

            // Listen for QR code
            sock.ev.on('connection.update', async (update) => {
                const { connection, qr, lastDisconnect } = update;

                if (qr) {
                    qrCodeData = qr;
                    console.log('📷 QR Code received');

                    try {
                        qrImageData = await QRCode.toDataURL(qr);

                        // Update session
                        const session = activeSessions.get(tempSessionId);
                        if (session) {
                            session.qr = qr;
                            session.qrImage = qrImageData;
                        }

                        // If user requested QR, send it now
                        if (method === 'qr' && !responseSent) {
                            responseSent = true;
                            clearTimeout(timeout);
                            res.json({
                                success: true,
                                qr: qrCodeData,
                                qrImage: qrImageData,
                                code: null,
                                sessionId: tempSessionId,
                                message: 'QR Code generated'
                            });
                            resolve();
                        }
                    } catch (e) {
                        console.error('QR Gen Error:', e);
                    }
                }

                // ... (Connection logic remains handled by event listener)
                if (connection === 'open') {
                    const session = activeSessions.get(tempSessionId);
                    if (session) {
                        session.connected = true;
                        session.ownerJid = sock.user.id;
                        // 15 is removed
                        // ... import moved to top

                        // ...

                        session.connected = true;
                        session.ownerJid = sock.user.id;

                        // 🔧 FIX: Use Short ID from Supabase (Like connect.js)
                        try {
                            const shortId = await uploadSessionToSupabase(authFolder);
                            console.log('✅ Short Session ID generated:', shortId);
                            session.sessionId = shortId;
                        } catch (err) {
                            console.error('⚠️ Supabase Upload Failed (using Long ID fallback):', err.message);
                            // Fallback to Long ID (Base64)
                            session.sessionId = encodeSession(authFolder);
                        }

                        await sendConfigMessage(sock, session.sessionId, phoneNumber);
                    }
                }
            });

            sock.ev.on('creds.update', saveCreds);

            // Handle Pairing Code
            if (method === 'pairing') {
                try {
                    console.log('📱 Requesting pairing code for:', phoneNumber);
                    // Delay slightly to let socket init
                    await delay(2000);

                    if (!sock.authState.creds.registered) {
                        pairingCode = await sock.requestPairingCode(phoneNumber);
                        console.log('✅ Pairing code generated:', pairingCode);

                        const session = activeSessions.get(tempSessionId);
                        if (session) session.code = pairingCode;

                        if (!responseSent) {
                            responseSent = true;
                            clearTimeout(timeout);
                            res.json({
                                success: true,
                                qr: null,
                                qrImage: null,
                                code: pairingCode,
                                sessionId: tempSessionId,
                                message: 'Pairing code generated'
                            });
                            resolve();
                        }
                    }
                } catch (e) {
                    console.error('Pairing Error:', e);
                    if (!responseSent) {
                        responseSent = true;
                        res.status(500).json({ error: 'Failed to generate pairing code' });
                        resolve();
                    }
                }
            } else {
                // Method QR: We just wait for the 'qr' event listener above
                console.log('📷 Waiting for QR Code...');
            }

        });

    } catch (error) {
        console.error('Error generating pairing code:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Check session connection status
 */
app.get('/api/session-status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        connected: session.connected,
        phoneNumber: session.phoneNumber,
        code: session.code,
        qrImage: session.qrImage || null, // Add this line
        sessionId: session.sessionId || null,
        ownerJid: session.ownerJid || null
    });
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        activeSessions: activeSessions.size,
        uptime: process.uptime()
    });
});

/**
 * Send configuration message to user's WhatsApp
 */
async function sendConfigMessage(sock, sessionId, phoneNumber) {
    try {
        await delay(2000); // Wait for connection to stabilize

        // Message 1: Welcome
        const welcomeMessage = `╭──────────────⬣
│ 🎉 *BIENVENUE SUR WBOT !*
╰──────────────⬣

Félicitations ! Votre bot WhatsApp est maintenant connecté avec succès.

✨ *WBOT* est un bot multifonctions qui vous permet de :

📸 Sauvegarder les messages view-once
📱 Télécharger les statuts WhatsApp
👻 Activer le mode fantôme (pas de coches bleues)
📹 Télécharger des vidéos (TikTok, Instagram, etc.)
⏰ Programmer des statuts
🗑️ Récupérer les messages supprimés

━━━━━━━━━━━━━━━━━━
*Un message va suivre avec vos informations de déploiement...*
━━━━━━━━━━━━━━━━━━`;

        await sock.sendMessage(sock.user.id, { text: welcomeMessage });
        await delay(2000);

        // Message 2: Configuration
        const configMessage = `╭──────────────⬣
│ ⚙️ *CONFIG RENDER*
╰──────────────⬣

Copiez TOUT ce bloc pour vos variables :

\`\`\`
SESSION_ID=${sessionId}
OWNER_ID=${phoneNumber}
NOM_OWNER=VotreNom
MODE=private
STICKER_AUTHOR_NAME=VotreNom
PREFIXE=.
\`\`\`

⚠️ *INSTRUCTIONS* :
1. Allez sur Render > Blueprint > New
2. Connectez GitHub
3. Collez ce SESSION_ID quand demandé
4. Deploy ! 🚀

━━━━━━━━━━━━━━━━━━
*COMMANDES DU BOT :*
━━━━━━━━━━━━━━━━━━

• .help - Liste des commandes
• .ghost - Mode fantôme ON/OFF
• .save - Sauvegarder view-once
• .dlstatus - Télécharger statut
• .dl [url] - Télécharger vidéo

━━━━━━━━━━━━━━━━━━
💡 *Conservez votre SESSION_ID en sécurité*
🔒 *Ne le partagez jamais avec personne*
━━━━━━━━━━━━━━━━━━

*WBOT v1.0* - Développé par Luis-Orvann`;

        await sock.sendMessage(sock.user.id, { text: configMessage });
        console.log('✅ Welcome & Configuration messages sent to WhatsApp');
    } catch (error) {
        console.error('Error sending messages:', error);
    }
}

// Start server
export function startApiServer() {
    app.listen(PORT, () => {
        console.log(`\n🌐 API Server running on port ${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/api/health\n`);
    });
}

export default app;
