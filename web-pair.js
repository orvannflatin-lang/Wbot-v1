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
import QRCode from 'qrcode';
import { uploadSessionToSupabase } from './src/utils/supabase-session.js';
import { encodeSession } from './src/utils/session-handler.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('web'));

// Config optimisée
const BOT_CONFIG = {
    browser: Browsers.macOS("Desktop"), // Changement de signature pour éviter le 515
    markOnlineOnConnect: true, // Force online
    syncFullHistory: false,    // Plus rapide
    printQRInTerminal: true,   // Utile pour debug terminal
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 5000
};

let activePairings = new Map();

async function startPairing(phoneNumber, method = 'pairing') {
    const sessionId = `pair-${Date.now()}`;
    const authPath = `./temp_sessions/${sessionId}`;

    // 1. Création sécurisée des dossiers
    if (!fs.existsSync('./temp_sessions')) {
        try { fs.mkdirSync('./temp_sessions'); } catch (e) { }
    }

    // Nettoyage préventif
    if (fs.existsSync(authPath)) {
        try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (e) { }
    }

    // 2. Initialisation Auth
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    // 3. Création Socket
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }), // Silent pour éviter le spam, passer en 'info' pour debug
        ...BOT_CONFIG
    });

    const pairingData = {
        sock,
        phoneNumber,
        method,
        code: null,
        qrImage: null,
        connected: false,
        sessionId: null,
        authPath
    };

    activePairings.set(sessionId, pairingData);

    return new Promise(async (resolve, reject) => {
        // Timeout global de 2 minutes pour laisser le temps de tout faire
        const timeout = setTimeout(() => {
            reject(new Error('Timeout Global: Trop long (2min)'));
        }, 120000);

        try {
            // MODE PAIRING CODE
            if (method === 'pairing' && !sock.authState.creds.registered) {
                console.log('\n⏳ Initialisation socket (attente 5s)...');
                await delay(5000); // CRITIQUE: Attendre que le socket soit CAILLÉ avant de demander

                try {
                    console.log(`⏳ Demande code pour ${phoneNumber}...`);
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`✅ Code généré: ${code}`); // C'est ici que l'utilisateur doit voir le code
                    pairingData.code = code;
                    resolve({ sessionId, code }); // On répond au frontend immédiatement
                } catch (codeErr) {
                    console.error('❌ Echec demande code:', codeErr.message);
                    // Si erreur 428, c'est souvent qu'on n'a pas attendu assez ou socket instable
                    throw codeErr;
                }
            }

            // EVENTS SOCKET
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // MODE QR
                if (method === 'qr' && qr) {
                    console.log('📷 QR Code reçu');
                    try {
                        const qrImage = await QRCode.toDataURL(qr);
                        pairingData.qrImage = qrImage;
                        resolve({ sessionId, qrImage });
                    } catch (e) { console.error('Erreur QR Generation:', e); }
                }

                if (connection === 'close') {
                    const reason = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                    console.log(`⚠️ Connexion fermée (Code: ${reason}). Reconnexion probable...`);

                    // Code 515 = Restart Required (Normal pendant le setup)
                    // On ne fait rien, Baileys va reconnecter tout seul car on n'a pas fermé le socket

                    if (reason === DisconnectReason.loggedOut) {
                        console.log('❌ Logged Out (Session invalide ou finie).');
                        pairingData.connected = false;
                        // cleanup?
                    }
                }

                if (connection === 'open') {
                    console.log('✅ CONNEXION WHATSAPP RÉUSSIE !');
                    pairingData.connected = true;
                    // Note: La promesse a déjà été résolue si on a envoyé le code/QR.
                    // C'est maintenant qu'on sauvegarde la session.

                    try {
                        console.log('💾 Sauvegarde dans Supabase...');
                        const shortId = await uploadSessionToSupabase(authPath, phoneNumber);
                        pairingData.sessionId = shortId;
                        console.log(`🎉 SUCCÈS TOTAL ! Session ID: ${shortId}`);
                        console.log(`👉 Envoyé au frontend.`);

                        // ENVOI DES MESSAGES SUR WHATSAPP
                        const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                        await delay(2000);

                        // Message 1 : Bienvenue
                        const welcomeMsg = `🤖 *WBOT CONNECTÉ AVEC SUCCÈS !*\n\n` +
                            `Bienvenue sur votre bot WhatsApp.\n` +
                            `Votre session est sécurisée dans Supabase.\n\n` +
                            `⏳ *Envoi de vos variables de déploiement dans 2 secondes...*`;

                        await sock.sendMessage(myJid, { text: welcomeMsg });

                        await delay(2000);

                        // Message 2 : Configuration Render
                        const configMsg = `🚀 *CONFIGURATION RENDER*\n\n` +
                            `Voici les variables à mettre sur Render :\n\n` +
                            `SESSION_ID: ${shortId}\n` +
                            `OWNER_ID: ${phoneNumber}\n` +
                            `NOM_OWNER: MonBot\n` +
                            `MODE: public\n` +
                            `STICKER_AUTHOR_NAME: WBOT\n` +
                            `PREFIXE: .\n\n` +
                            `*Copiez-collez ces valeurs dans les 'Environment Variables' de Render.*`;

                        await sock.sendMessage(myJid, { text: configMsg });
                        console.log('✅ Messages de bienvenue envoyés sur WhatsApp !');

                    } catch (err) {
                        console.error('❌ Erreur Upload SQL:', err.message);
                        pairingData.sessionId = encodeSession(authPath);
                    }
                }
            });

            sock.ev.on('creds.update', saveCreds);

        } catch (err) {
            clearTimeout(timeout);
            reject(err);
        }
    });
}

// Routes API
app.post('/api/request-pairing', async (req, res) => {
    const { phoneNumber, method } = req.body;
    console.log(`\n📨 Nouvelle requête: ${method.toUpperCase()} -> ${phoneNumber || 'QR'}`);

    try {
        const result = await startPairing(phoneNumber, method);
        res.json({
            success: true,
            sessionId: result.sessionId,
            code: result.code,
            qrImage: result.qrImage
        });
    } catch (err) {
        console.error('❌ Erreur Route API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/session-status/:sessionId', (req, res) => {
    const data = activePairings.get(req.params.sessionId);
    if (!data) return res.status(404).json({ error: 'Session introuvable' });

    res.json({
        connected: data.connected,
        sessionId: data.sessionId
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 SERVEUR DE PAIRAGE LANCÉ`);
    console.log(`👉 URL: http://localhost:${PORT}`);
    console.log(`📝 Logs:`);
});
