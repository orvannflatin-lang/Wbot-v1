import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import fs from 'fs';
import pino from 'pino'; // Added missing import // Added missing import
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

// Global variable to track the current pairing socket
// Global variable to track the current pairing socket
let globalPairingSock = null;
const activeSessions = new Map(); // Restored missing map

export const startApiServer = (app) => {

    // Configure CORS for Netlify + Localhost
    const corsOptions = {
        origin: [
            'https://wbot-v1.netlify.app',  // Production Netlify
            'http://localhost:3000',         // Dev local
            'http://127.0.0.1:3000'          // Dev local alternate
        ],
        methods: ['GET', 'POST'],
        credentials: true,
        optionsSuccessStatus: 200
    };

    app.use(cors(corsOptions));
    app.use(express.json());
    app.use(express.static('web')); // Serve frontend files

    // Fallback route for SPA
    app.get('/', (req, res) => {
        res.sendFile('index.html', { root: 'web' });
    });

    // API endpoint to request pairing code or QR
    app.post('/api/request-pairing', async (req, res) => {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔵 [STEP 0/8] NEW PAIRING REQUEST RECEIVED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 🛑 CLEANUP: If a previous socket exists, kill it to prevent conflicts
        try {
            if (globalPairingSock) {
                console.log('⚠️ [CLEANUP] Closing previous pairing socket...');
                if (typeof globalPairingSock.end === 'function') {
                    globalPairingSock.end(undefined);
                } else if (globalPairingSock.ws && typeof globalPairingSock.ws.close === 'function') {
                    globalPairingSock.ws.close();
                }
                globalPairingSock = null;
                console.log('✅ [CLEANUP] Previous socket closed');
            }
        } catch (e) {
            console.error('❌ [CLEANUP] Error closing previous socket (ignored):', e.message);
            globalPairingSock = null;
        }

        const { phoneNumber, method } = req.body;

        // Anti-spam debounce
        const now = Date.now();
        if (globalPairingSock && (now - (globalPairingSock.lastRequestTime || 0)) < 5000) {
            return res.status(429).json({ error: 'Please wait 5 seconds before retrying' });
        }

        // Use a FIXED folder for pairing to ensure stability/permissions
        const authFolder = `./auth_info_pairing`;
        const tempSessionId = `temp-${Date.now()}`;

        // Initialize variables to avoid ReferenceError
        let responseSent = false;
        let qrCodeData = null;
        let qrImageData = null;
        let pairingCode = null;

        try {

            // 🔧 FIX: Clean session folder robustly
            console.log('🧹 [STEP 1/8] Cleaning session folder...');
            if (fs.existsSync(authFolder)) {
                fs.rmSync(authFolder, { recursive: true, force: true });
                console.log('✅ [STEP 1/8] Session cleaned:', authFolder);
            } else {
                console.log('ℹ️ [STEP 1/8] No previous session to clean');
            }

            // Create auth state
            console.log('🔧 [STEP 2/8] Creating auth state...');
            const { state, saveCreds } = await useMultiFileAuthState(authFolder);
            console.log('✅ [STEP 2/8] Auth state created');

            // Debug wrapper
            const saveCredsDebug = (params) => {
                console.log('💾 [CREDS] Saving credentials to disk...');
                return saveCreds(params);
            };

            console.log('🔧 [STEP 3/8] Creating WhatsApp socket...');

            const { version } = await fetchLatestBaileysVersion();
            console.log(`ℹ️ Baileys Version: v${version.join('.')}`);

            console.log('   Config:', {
                browser: 'Ubuntu/Chrome',
                timeout: '60s',
                syncHistory: false,
                markOnline: false
            });

            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                logger: pino({ level: 'silent' }),
                browser: ["Ubuntu", "Chrome", "20.0.04"], // ✅ Signature Standard
                markOnlineOnConnect: false,
                syncFullHistory: false,
                printQRInTerminal: false,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 10000
            });

            console.log('✅ [STEP 3/8] Socket created');
            console.log('   Registered:', sock.authState.creds.registered ? 'YES' : 'NO (new session)');
            console.log('   User ID:', sock.authState.creds.me?.id || 'Not yet authenticated');

            // Assign to global variable for future cleanup
            globalPairingSock = sock;
            globalPairingSock.lastRequestTime = Date.now();

            // Store session early
            activeSessions.set(tempSessionId, {
                phoneNumber,
                connected: false,
                code: null,
                qr: null,
                qrImage: null,
                sessionId: null
            });

            // Request pairing code FIRST
            if (method === 'pairing' && !sock.authState.creds.registered) {
                console.log('\n📱 [STEP 4/8] Requesting pairing code for:', phoneNumber);
                console.log('⏳ [STEP 4/8] Waiting 2s (OVL delay)...');
                await delay(2000);

                console.log('🔐 [STEP 4/8] Calling sock.requestPairingCode()...');
                pairingCode = await sock.requestPairingCode(phoneNumber);
                console.log('✅ [STEP 4/8] Pairing code generated:', pairingCode);

                const session = activeSessions.get(tempSessionId);
                if (session) session.code = pairingCode;

                res.json({
                    success: true,
                    qr: null,
                    qrImage: null,
                    code: pairingCode,
                    sessionId: tempSessionId,
                    message: 'Pairing code generated'
                });

                console.log('📤 [STEP 4/8] Response sent to frontend\n');
            }

            console.log('🎧 [STEP 5/8] Attaching event listeners...');

            // Event listeners
            sock.ev.on('connection.update', async (update) => {
                const { connection, qr, lastDisconnect } = update;

                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🔄 [EVENT] CONNECTION UPDATE');
                console.log('   Status:', connection || 'pending');
                console.log('   QR:', qr ? 'Generated' : 'N/A');
                console.log('   Error Code:', lastDisconnect?.error?.output?.statusCode || 'None');
                console.log('   Error Msg:', lastDisconnect?.error?.message || 'None');

                if (lastDisconnect?.error) {
                    console.log('\n⚠️ [ERROR DETAILS]');
                    console.log('   Name:', lastDisconnect.error.name);
                    console.log('   Message:', lastDisconnect.error.message);
                    console.log('   Data:', JSON.stringify(lastDisconnect.error.data, null, 2));
                }
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                if (qr && method === 'qr') {
                    try {
                        qrImageData = await QRCode.toDataURL(qr);
                        const session = activeSessions.get(tempSessionId);
                        if (session) {
                            session.qr = qr;
                            session.qrImage = qrImageData;
                        }
                        console.log('📷 QR Code received and encoded');
                    } catch (e) {
                        console.error('❌ QR Gen Error:', e.message);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    console.error('❌ [STEP 8/8] CONNECTION CLOSED');
                    console.error('   Reason Code:', statusCode);
                    console.error('   Reason:', statusCode === 515 ? 'Stream Error (possibly IP blocked)' : 'Unknown');

                    const session = activeSessions.get(tempSessionId);
                    if (session) {
                        session.connected = false;
                        session.qr = null;
                        session.qrImage = null;
                        session.code = null;
                    }
                }

                if (connection === 'open') {
                    console.log('\n🎉 [STEP 6/8] CONNECTION OPEN!');
                    const session = activeSessions.get(tempSessionId);
                    if (session) {
                        session.connected = true;
                        session.ownerJid = sock.user.id;
                        console.log('   Owner JID:', sock.user.id);

                        console.log('\n📁 [STEP 7/8] Uploading session to Supabase...');
                        try {
                            const shortId = await uploadSessionToSupabase(authFolder);
                            console.log('✅ [STEP 7/8] Short Session ID:', shortId);
                            session.sessionId = shortId;
                        } catch (err) {
                            console.error('⚠️ [STEP 7/8] Supabase failed:', err.message);
                            console.log('   Using long ID fallback...');
                            session.sessionId = encodeSession(authFolder);
                            console.log('✅ [STEP 7/8] Long Session ID generated');
                        }

                        console.log('\n📨 [STEP 8/8] Sending welcome messages to WhatsApp...');
                        await sendConfigMessage(sock, session.sessionId, phoneNumber);
                        console.log('✅ [STEP 8/8] Messages sent!');
                        console.log('\n🎊 FLOW COMPLETED SUCCESSFULLY!\n');
                    }
                }
            });

            sock.ev.on('creds.update', saveCredsDebug);
            console.log('✅ [STEP 5/8] Event listeners attached');
            console.log('⏳ Waiting for WhatsApp to respond...\n');
        } catch (error) {
            console.error('Error generating pairing code:', error);
            res.status(500).json({ error: error.message });
        }
    }); // End of app.post

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
NODE_ENV=production
PORT=10000
\`\`\`

⚠️ *INSTRUCTIONS* :
1. Allez sur render.com → New Web Service
2. Connectez le repo GitHub : Wbot-v1
3. Collez TOUTES ces variables dans "Environment"
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

    // Start server removed (handled by start.js via app export)
    // app.listen moved to start.js or handled by startApiServer call if needed, but here we just export app or function.
    // Actually, start.js imports startApiServer and calls it.
    // The top definition is correct. This one is closing the file.

}; // Match startApiServer


