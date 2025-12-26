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
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Generate unique session ID
        const tempSessionId = generateSessionId();
        const authFolder = `./temp_sessions/${tempSessionId}`;

        // Create auth state
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);

        // Create socket with QR code enabled
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome"), // Changement pour Linux/Render
            printQRInTerminal: false,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            connectTimeoutMs: 60000, // Augmenter le timeout à 60s
            keepAliveIntervalMs: 10000, // Keep-alive toutes les 10s
            retryRequestDelayMs: 5000
        });

        // ... (reste du code)

        // Listen for QR code and connection
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update; // Ajouter lastDisconnect

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log('❌ Connection closed. Reason:', reason, 'Error:', lastDisconnect?.error);
            }

            if (qr) {
                qrCodeData = qr;
                const session = activeSessions.get(tempSessionId);
                if (session) {
                    session.qr = qr;

                    // Generate QR image
                    try {
                        const qrImage = await QRCode.toDataURL(qr);
                        session.qrImage = qrImage;
                        console.log('✅ QR Code image generated');
                    } catch (qrError) {
                        console.error('❌ QR image error:', qrError.message);
                    }
                }
            }

            if (connection === 'open') {
                const session = activeSessions.get(tempSessionId);
                if (session) {
                    session.connected = true;
                    session.ownerJid = sock.user.id;

                    // Encode session
                    const sessionId = encodeSession(authFolder);
                    session.sessionId = sessionId;

                    // Send WhatsApp message with config
                    await sendConfigMessage(sock, sessionId, phoneNumber);
                    console.log('✅ Connected and config sent');
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Request pairing code IMMEDIATELY
        try {
            console.log('📱 Requesting pairing code for:', phoneNumber);
            pairingCode = await sock.requestPairingCode(phoneNumber);
            console.log('✅ Pairing code generated:', pairingCode);

            const session = activeSessions.get(tempSessionId);
            if (session) session.code = pairingCode;

        } catch (pairingError) {
            console.error('❌ Pairing code error:', pairingError.message);

            // If pairing fails, wait for QR
            console.log('⏳ Waiting for QR code generation...');
            await delay(5000);

            const session = activeSessions.get(tempSessionId);
            if (session && session.qr) {
                qrCodeData = session.qr;
                qrImageData = session.qrImage;
                console.log('✅ QR Code available as fallback');
            } else if (!pairingCode) {
                sock.end();
                return res.status(500).json({
                    error: 'Impossible de générer le code',
                    details: 'Problème de connexion WhatsApp. Réessayez.'
                });
            }
        }

        // If no QR image yet but we have QR data, generate it now
        if (!qrImageData && qrCodeData) {
            try {
                qrImageData = await QRCode.toDataURL(qrCodeData);
                const session = activeSessions.get(tempSessionId);
                if (session) session.qrImage = qrImageData;
            } catch (qrError) {
                console.error('❌ QR image generation error:', qrError.message);
            }
        }

        // Update session with latest data
        const session = activeSessions.get(tempSessionId);
        if (session) {
            session.qr = qrCodeData;
            session.qrImage = qrImageData;
            session.code = pairingCode;
        }

        res.json({
            success: true,
            qr: qrCodeData || null,
            qrImage: qrImageData || null,
            code: pairingCode || null,
            sessionId: tempSessionId,
            message: pairingCode ? 'Pairing code generated' : (qrCodeData ? 'QR Code generated' : 'Session created')
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
│ 📋 *VOS INFORMATIONS DE DÉPLOIEMENT*
╰──────────────⬣

⚠️ *IMPORTANT* : Copiez ces informations pour déployer votre bot sur Render.

━━━━━━━━━━━━━━━━━━
*VARIABLES D'ENVIRONNEMENT :*
━━━━━━━━━━━━━━━━━━

\`\`\`
SESSION_ID=${sessionId}

OWNER_ID=${phoneNumber}

PREFIXE=.

NOM_OWNER=VotreNom
\`\`\`

━━━━━━━━━━━━━━━━━━
*ÉTAPES DE DÉPLOIEMENT :*
━━━━━━━━━━━━━━━━━━

1️⃣ Allez sur render.com
2️⃣ Cliquez "New +" → "Web Service"  
3️⃣ Connectez ce repo GitHub :
   https://github.com/VOTRE_USERNAME/WBOT

4️⃣ Ajoutez les variables ci-dessus
5️⃣ Cliquez "Create Web Service"
6️⃣ ✅ Votre bot sera en ligne 24/7 !

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
