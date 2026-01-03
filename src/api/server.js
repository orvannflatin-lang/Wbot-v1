import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    fetchLatestBaileysVersion, // Import this
    delay
} from '@whiskeysockets/baileys';
// ... (imports remain)

// ...

const activeSessions = new Map();

export const startApiServer = (app) => {

    // API endpoint to request pairing code or QR
    app.post('/api/request-pairing', async (req, res) => {
        const { phoneNumber, method } = req.body;
        const tempSessionId = `temp-${Date.now()}`;
        const authFolder = `./auth_info/temp_session_${tempSessionId}`; // Use temp ID for folder

        // 🔧 FIX: Clean session folder robustly (like connect-fix.js)
        if (fs.existsSync(authFolder)) {
            fs.rmSync(authFolder, { recursive: true, force: true });
            console.log('🧹 Session cleaned:', authFolder);
        }

        // Create auth state
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        // 🔧 FIX: Fetch latest version properly (Crucial for "Impossible to connect")
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`🤖 Baileys v${version.join('.')} (Latest: ${isLatest})`);

        // Create socket
        const sock = makeWASocket({
            version, // USE THE FETCHED VERSION
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'info' })) // Enable logs for debug
            },
            logger: pino({ level: 'info' }), // Enable logs for debug
            // 🔧 FIX: USER EXPERT CONFIG (Security Bypass)
            browser: ["Ubuntu", "Chrome", "20.0.04"],

            // 🚀 LIGHTWEIGHT CONNECTION MODE
            syncFullHistory: false,
            maxChatMessages: 10,

            // Stub getMessage
            getMessage: async (key) => {
                return { conversation: 'OVL-BOT' };
            },

            // ⏳ TIMEOUTS
            connectTimeoutMs: 60000, // Revert to 60s (90s might be too long for heartbeat)
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            retryRequestDelayMs: 5000,

            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false
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
            // DEBUG: Log ALL events to see handshake progress
            const allowedEvents = ['connection.update', 'creds.update', 'messaging-history.set'];
            /* 
            sock.ev.on('messages.upsert', (m) => console.log('📥 UPSERT DEBUG', JSON.stringify(m, null, 2)));
            */

            sock.ev.on('connection.update', async (update) => {
                const { connection, qr, lastDisconnect } = update;

                // DEBUG LOG
                console.log(`[DEBUG] Connection Update: ${connection || 'pending'} | QR: ${!!qr} | Error: ${lastDisconnect?.error}`);

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
                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    const statusCode = (lastDisconnect.error)?.output?.statusCode;

                    console.error('❌ Connection Closed. Code:', statusCode);
                    console.error('⚠️ Error Details:', lastDisconnect?.error); // Detailed logs

                    if (shouldReconnect) {
                        console.log('🔄 Reconnecting...');
                        // ... logic
                    } else {  // 15 is removed
                        // ... import moved to top

                        // ...

                        const session = activeSessions.get(tempSessionId);
                        if (session) {
                            session.connected = false; // Mark as disconnected
                            session.qr = null;
                            session.qrImage = null;
                            session.code = null;
                            // Optionally, clear sessionId if it's a permanent logout
                            if (statusCode === DisconnectReason.loggedOut) {
                                session.sessionId = null;
                                console.log('🗑️ Session permanently logged out.');
                            }
                        }
                        console.log('🛑 Connection closed permanently (logged out or unrecoverable error).');
                    }
                }
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
