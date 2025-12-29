import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import { startApiServer } from './src/api/server.js';
import { initDatabase } from './src/database/schema.js';
import { OVLHandler } from './src/handlers/ovl_handler.js';

const PORT = process.env.PORT || 3000;

// 🔧 FIX: Flag pour éviter les messages de bienvenue répétés
let welcomeMessageSent = false;

// 🗄️ Cache pour stocker les messages (pour Anti-Delete)
const messageCache = new Map();

// Démarrer API Server (Pour Render/Keep-Alive et Pairage Web)
startApiServer();

async function startWBOT() {
    console.log('🚀 Démarrage WBOT Starter...');

    // Init DB (pour AutoLike)
    await initDatabase();

    // 🔄 RESTAURATION SESSION DEPUIS ENV (Render/Deployment)
    // Si SESSION_ID est présent dans les variables d'environnement (Render)
    // On restaure le dossier auth_info avant de démarrer
    if (process.env.SESSION_ID) {
        // Importer dynamiquement pour éviter les dépendances au top-level si non utilisé
        const { decodeSession } = await import('./src/utils/session-handler.js');
        const authPath = './auth_info';

        // On ne restaure que si le dossier est vide ou que SESSION_ID a changé
        // En prod, le dossier est souvent éphémère de toute façon
        if (!fs.existsSync(authPath) || fs.readdirSync(authPath).length === 0) {
            console.log('🔄 Restauration de la session depuis SESSION_ID...');
            try {
                decodeSession(process.env.SESSION_ID, authPath);
            } catch (e) {
                console.error('❌ Échec restauration session:', e.message);
            }
        }
    }

    // Session Auth
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // Config Socket Optimisée Render (Ubuntu)
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Enable for terminal QR display
        // Signature "Ubuntu Chrome" pour éviter les blocages Render
        browser: Browsers.ubuntu("Chrome"),
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        syncFullHistory: false,
        markOnlineOnConnect: false // Discrétion OVL (Comme dans connect.js)
    });

    // 🔄 Événements de Connexion
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connexion fermée. Reconnexion:', shouldReconnect);
            if (shouldReconnect) {
                startWBOT();
            }
        } else if (connection === 'open') {
            console.log('✅ WBOT CONNECTÉ À WHATSAPP !');
            console.log('🆔 User:', sock.user.id);

            // 📢 NOTIFICATION DE DÉMARRAGE (Render Uniquement)
            if (process.env.RENDER || process.env.NODE_ENV === 'production') {
                const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                await sock.sendMessage(ownerJid, {
                    text: `🚀 *WBOT ACTIF ET CONNECTÉ*\n\n✅ Le bot tourne maintenant sur le serveur Render.\n🔋 Mémoire optimisée.\n✨ Prêt à servir !`
                });
            }

            // 🔧 FIX: N'envoyer le message de bienvenue qu'UNE SEULE FOIS
            if (!welcomeMessageSent) {
                welcomeMessageSent = true;

                const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                const phoneNumber = sock.user.id.split(':')[0];

                // Message 1: Bienvenue OVL-style
                const msgInfo = `╭───〔 🤖 WBOT 〕───⬣
│ ߷ Etat       ➜ Connecté ✅
│ ߷ Préfixe    ➜ .
│ ߷ Mode       ➜ private
│ ߷ Commandes  ➜ 10
│ ߷ Version    ➜ 1.0.0
│ ߷ *Développeur*➜ Luis Orvann
╰──────────────⬣`;

                // Message 2: Variables ENV pour déploiement
                const msgEnv = `╭──────────────⬣
│ 📋 *DÉPLOIEMENT RENDER*
╰──────────────⬣

Copiez ces variables :

\`\`\`
PREFIXE=.
NOM_OWNER=Luis Orvann
NUMERO_OWNER=${phoneNumber}
MODE=private
STICKER_AUTHOR_NAME=Luis Orvann
\`\`\`

⚠️ *SESSION_ID* : Voir message suivant\n\n💡 **Guide Render** :
1. render.com → New Web Service
2. Connecter votre repo GitHub
3. Coller ces variables
4. Deploy !`;

                // Envoyer les messages
                await sock.sendMessage(myJid, { text: msgInfo });
                await delay(1000);
                await sock.sendMessage(myJid, { text: msgEnv });

                // 🔧 FIX: Générer et envoyer le SESSION_ID
                try {
                    // Générer un ID court de 8 caractères (lettres + chiffres)
                    const generateShortId = () => {
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                        let id = 'WBOT~';
                        for (let i = 0; i < 8; i++) {
                            id += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                        return id;
                    };

                    const sessionId = generateShortId();

                    // Message 3: SESSION_ID
                    const msgSessionId = `╭──────────────⬣
│ 🔑 *SESSION_ID*
╰──────────────⬣

\`\`\`
SESSION_ID=${sessionId}
\`\`\`

⚠️ **IMPORTANT** :
• Gardez ce SESSION_ID en sécurité
• Ne le partagez JAMAIS
• Utilisez-le pour déployer sur Render

✅ Votre bot est prêt !`;

                    await delay(1000);
                    await sock.sendMessage(myJid, { text: msgSessionId });
                    console.log('🔑 SESSION_ID court envoyé:', sessionId);

                } catch (e) {
                    console.error('❌ Erreur génération SESSION_ID:', e.message);
                    await sock.sendMessage(myJid, { text: '⚠️ SESSION_ID non généré. Erreur: ' + e.message });
                }

                console.log('📨 Messages de bienvenue envoyés (1 fois seulement)');
            } else {
                console.log('ℹ️ Bot reconnecté (message de bienvenue déjà envoyé)');
            }
        }
    });

    // 💾 Sauvegarde Crédentials
    sock.ev.on('creds.update', saveCreds);

    // 📨 Écouter les messages entrants (Handler OVL)
    sock.ev.on('messages.upsert', async (msg) => {
        await OVLHandler(sock, msg);

        // 🗄️ Sauvegarder les messages pour Anti-Delete
        if (msg.messages && msg.messages[0]) {
            const m = msg.messages[0];
            if (m.key && m.message) {
                messageCache.set(m.key.id, {
                    key: m.key,
                    message: m.message,
                    messageTimestamp: m.messageTimestamp,
                    pushName: m.pushName || 'Unknown'
                });
            }
        }
    });

    // 🗑️ ANTI-DELETE: Écouter les suppressions de messages
    sock.ev.on('messages.delete', async (deletion) => {
        try {
            const { UserConfig } = await import('./src/database/schema.js');
            const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            // Récupérer la config anti-delete
            const config = await UserConfig.findOne({ where: { jid: ownerJid } });
            if (!config || !config.antidelete) return;

            const settings = JSON.parse(config.antidelete);
            if (!settings || Object.keys(settings).length === 0) return;

            // Vérifier chaque message supprimé
            for (const deletedKey of deletion.keys) {
                const cachedMsg = messageCache.get(deletedKey.id);
                if (!cachedMsg) continue;

                const { EMOJIS, toBold } = await import('./src/utils/textStyle.js');

                // Vérifier si on doit sauvegarder ce message
                const isGroup = deletedKey.remoteJid.endsWith('@g.us');
                const isStatus = deletedKey.remoteJid === 'status@broadcast';
                const isPrivate = !isGroup && !isStatus;

                let shouldSave = settings.all;
                if (!shouldSave) {
                    if (isPrivate && settings.pm) shouldSave = true;
                    if (isGroup && settings.gc) shouldSave = true;
                    if (isStatus && settings.status) shouldSave = true;
                }

                if (!shouldSave) continue;

                // Préparer le message de notification
                const sender = deletedKey.participant || deletedKey.remoteJid;
                const senderName = cachedMsg.pushName;
                const timeDeleted = new Date().toLocaleTimeString('fr-FR');

                let notifText = `${EMOJIS.delete} *${toBold('MESSAGE SUPPRIMÉ')}*\n\n`;
                notifText += `${EMOJIS.bullet} ${toBold('De')} ${EMOJIS.arrow} ${senderName}\n`;
                notifText += `${EMOJIS.bullet} ${toBold('Heure')} ${EMOJIS.arrow} ${timeDeleted}\n`;
                notifText += `${EMOJIS.bullet} ${toBold('Type')} ${EMOJIS.arrow} ${isGroup ? 'Groupe' : isStatus ? 'Statut' : 'Privé'}\n\n`;

                // Extraire le contenu du message
                const msgType = Object.keys(cachedMsg.message)[0];
                const msgContent = cachedMsg.message[msgType];

                if (msgContent?.text || msgContent?.caption) {
                    notifText += `${EMOJIS.info} *Contenu:*\n${msgContent.text || msgContent.caption}`;
                }

                // Envoyer la notification à l'owner
                await sock.sendMessage(ownerJid, { text: notifText });

                // Si c'est un média, le renvoyer aussi
                if (msgContent?.mimetype) {
                    try {
                        await sock.sendMessage(ownerJid, {
                            forward: { key: cachedMsg.key, message: cachedMsg.message }
                        });
                    } catch (e) {
                        console.error('Erreur forward media:', e);
                    }
                }

                // Supprimer du cache après traitement
                messageCache.delete(deletedKey.id);
            }
        } catch (error) {
            console.error('❌ Erreur Anti-Delete:', error);
        }
    });

    return sock;
}

// Lacer le bot
startWBOT();

// 🧹 NETTOYAGE MÉMOIRE OPTIMISÉ (Render Friendly)
// AMDA Style: Nettoyage fréquent pour rester sous les 512MB RAM
setInterval(() => {
    const timeLimit = Date.now() - (30 * 60 * 1000); // Garder 30 min d'historique (vs 1h avant)
    let deletedCount = 0;

    for (const [id, msg] of messageCache.entries()) {
        if (msg.messageTimestamp < timeLimit / 1000) {
            messageCache.delete(id);
            deletedCount++;
        }
    }

    // Forcer le Garbage Collector si disponible (Node flag --expose-gc nécessaire, mais bon en prévision)
    if (global.gc) {
        global.gc();
    }

    console.log(`🧹 Cache nettoyé: ${deletedCount} suppression(s). Reste: ${messageCache.size} messages.`);
}, 10 * 60 * 1000); // Vérification toutes les 10 minutes (vs 1h)

console.log('🌐 Serveur Web en écoute...');
