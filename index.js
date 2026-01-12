import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import util from 'util'; // Pour le formatage des logs
import { initDatabase } from './src/database/schema.js';
import { OVLHandler } from './src/handlers/ovl_handler.js';
import { startApiServer } from './src/api/server.js'; // Ensure this is imported if used

// 🤫 SILENCE FORCE (Filtrage ULTIME des logs)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

const SILENCED_PATTERNS = [
    'Session error', 'Bad MAC', 'MessageCounterError', 'Failed to decrypt', // Erreurs techniques
    'closing session', 'Closing session', 'SessionEntry', 'chains:', 'currentRatchet:', 'registrationId', // Dumps de session
    'Decrypted message', // Bruit Libsignal
    'Service de planification', // Scheduler
    'Démarrage du nettoyage', 'Rien à nettoyer', // Cleaner
    'preKey', 'signedKeyId', 'remoteIdentityKey', 'lastRemoteEphemeralKey', 'baseKey', // Key dumps
    'Unknown message', 'Duplicate message', 'indexInfo', 'ephemeralKeyPair', 'rootKey' // Autres bruits
];

// ... (existing code)

// ✅ ANTI-DELETE CACHE (Messages + Statuts)
if (m.message && !m.message.protocolMessage && !m.key.fromMe) {
    messageCache.set(m.key.id, m);

    // Log pour montrer que le message est en cache
    const msgType = Object.keys(m.message)[0];

    // 🔇 IGNORER les messages techniques (Clés, Protocol)
    const IGNORED_TYPES = ['senderKeyDistributionMessage', 'protocolMessage', 'messageContextInfo'];
    if (!IGNORED_TYPES.includes(msgType)) {
        const senderName = m.pushName || 'Inconnu';
        const isStatus = from === 'status@broadcast';
        const label = isStatus ? '📢 STATUT' : '💾 CACHE';
        console.log(`${label}: Message de ${senderName} (${msgType}) → ID: ${m.key.id.substring(0, 20)}...`);
    }

    setTimeout(() => messageCache.delete(m.key.id), 60 * 60 * 1000);
}

function shouldSilence(args) {
    const msg = args.map(arg => {
        if (typeof arg === 'object') {
            try { return JSON.stringify(arg); } catch { return String(arg); }
        }
        return String(arg);
    }).join(' ');

    return SILENCED_PATTERNS.some(pattern => msg.includes(pattern));
}

console.error = function (...args) {
    if (shouldSilence(args)) return;
    originalConsoleError.apply(console, args);
};

console.warn = function (...args) {
    if (shouldSilence(args)) return;
    originalConsoleWarn.apply(console, args);
};

console.log = function (...args) {
    const msg = util.format(...args);
    // ✅ WHITELIST : Toujours afficher les commandes et réponses + Info connexion
    if (msg.includes('✅ COMMANDE') ||
        msg.includes('🤖 REPONSE BOT') ||
        msg.includes('WBOT CONNECTÉ') ||
        msg.includes('User:')) {
        originalConsoleLog.apply(console, args);
        return;
    }

    if (shouldSilence(args)) return;
    originalConsoleLog.apply(console, args);
};

const PORT = process.env.PORT || 3000;

// 🔧 FIX: Flag pour éviter les messages de bienvenue répétés
let welcomeMessageSent = false;

// 🗄️ Cache amélioré pour stocker les messages (Anti-Delete + View Once)
// Structure: { key, message, messageTimestamp, pushName, isViewOnce, rawData, viewOnceContent }
const messageCache = new Map();

// (Serveur Web géré par start.js)

let lastConnectLog = 0; // Anti-Spam connexion

async function startWBOT() {
    const BOT_START_TIME = Math.floor(Date.now() / 1000) - 60; // Timestamp démarrage (-60s pour marge)

    // ------------------------------------------------------
    // ⚙️ CONFIGURATION MULTI-SESSION (SUPABASE)
    // ------------------------------------------------------Initialisation Base de Données
    await initDatabase();

    // 🧹 Nettoyage Automatique au démarrage (Vieux fichiers > 3 jours)
    const { cleanOldData } = await import('./src/utils/cleaner.js');
    cleanOldData(); // Lancer une fois maintenant
    setInterval(() => cleanOldData(), 24 * 60 * 60 * 1000); // Puis toutes les 24h

    // 🔄 RESTAURATION SESSION DEPUIS SUPABASE (Via SESSION_ID)
    // Si SESSION_ID est fourni (Render/Prod), on télécharge les IDs de connexion depuis la table SQL
    if (process.env.SESSION_ID) {
        // ... (Code existant inchangé pour la restauration) ...
        try {
            // Import statique ou dynamique
            const { restoreSessionFromSupabase } = await import('./src/utils/supabase-session.js');
            const authPath = './auth_info';
            await restoreSessionFromSupabase(process.env.SESSION_ID, authPath);
        } catch (e) {
            // Silence en cas d'erreur non critique ou déjà loggée
        }
    }

    // 🔄 Version Check (Auto)

    // Session Auth
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // Caches pour l'optimisation
    const groupCache = new Map();

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }).child({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false, // QR handled manually
        keepAliveIntervalMs: 10000,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        shouldSyncHistoryMessage: () => false,
        syncFullHistory: false,
        cachedGroupMetadata: async (jid) => groupCache.get(jid),
        getMessage: async (key) => {
            const msg = messageCache.get(key.id);
            return msg?.message || undefined;
        },
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 5000
    });

    // 🕵️ LOG DES RÉPONSES (Demande Utilisateur)
    const originalSendMessage = sock.sendMessage;
    sock.sendMessage = async (jid, content, options) => {
        // On ne loggue que les messages TEXTE envoyés par le bot (pas les events tech)
        if (content && content.text) {
            console.log('\x1b[36m%s\x1b[0m', `🤖 REPONSE BOT: ${content.text.substring(0, 60).replace(/\n/g, ' ')}...`);
        }
        return await originalSendMessage.call(sock, jid, content, options);
    };

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const error = lastDisconnect?.error;
            const statusCode = error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (statusCode === 515) {
                console.log('⚠️ Warning: Stream Errored (515). Tentative de reconnexion...');
            }

            // Log uniquement si c'est une déconnexion définitive
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('❌ Session déconnectée (Logged Out). Veuillez scanner le QR code à nouveau.');
            } else if (shouldReconnect) {
                // Reconnexion silencieuse avec délai pour éviter le spam
                // On attend un peu plus si c'est une 515 pour laisser le stream se fermer proprement
                setTimeout(startWBOT, statusCode === 515 ? 5000 : 3000);
            }
        } else if (connection === 'open') {
            // Anti-Spam du log de connexion (Si < 5s, on ignore les doublons)
            const now = Date.now();
            if (now - lastConnectLog < 5000) return;
            lastConnectLog = now;

            // console.log('✅ WBOT CONNECTÉ À WHATSAPP !');
            // console.log('🆔 User:', sock.user.id);

            // ⏰ Démarrer le Scheduler (Cron)
            const { initScheduler } = await import('./src/utils/scheduler.js');
            initScheduler(sock);


            // Charger les commandes (si nécessaire) ? Non, géré par handler.

            // 🔧 FIX: N'envoyer le message de bienvenue qu'UNE SEULE FOIS
            if (!welcomeMessageSent) {
                welcomeMessageSent = true;

                const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

                // Message simple de succès (Pour éviter doublon si reconnecté)
                // await sock.sendMessage(myJid, { text: '✅ *WBOT connecté avec succès*' });

                // 🚀 UPLOAD SUPABASE & RÉCUPÉRATION DU VRAI ID
                let realSessionId = process.env.SESSION_ID; // Si on est déjà sur Render, on garde l'actuel

                if (!realSessionId) {
                    try {
                        const { uploadSessionToSupabase } = await import('./src/utils/supabase-session.js');
                        const myPhone = sock.user.id.split(':')[0];
                        realSessionId = await uploadSessionToSupabase('./auth_info', myPhone);

                        console.log('\n╭───────────────────────────────────────────────╮');
                        console.log('│ ✅ SESSION SAUVEGARDÉE DANS SUPABASE !        │');
                        console.log('│                                               │');
                        console.log(`│ ID: ${realSessionId}                               │`);
                        console.log('╰───────────────────────────────────────────────╯\n');
                    } catch (err) {
                        console.error('❌ Echec sauvegarde Supabase msg:', err.message);
                        realSessionId = 'ERREUR_UPLOAD_SUPABASE';
                    }
                }

                const phoneNumber = sock.user.id.split(':')[0];

                // Message 1 : Infos Bot
                const prefix = '.';
                const msg1 = `╭───〔 🤖 WBOT 〕───⬣
│ ߷ Etat       ➜ Connecté ✅
│ ߷ Préfixe    ➜ ${prefix}
│ ߷ Mode       ➜ private
│ ߷ Commandes  ➜ 10
│ ߷ Version    ➜ 1.0.0
│ ߷ *Développeur*➜ Luis Orvann
╰──────────────⬣`;

                await sock.sendMessage(myJid, { text: msg1 });

                // Récupération dynamique du nom WhatsApp de l'utilisateur
                const ownerName = sock.user.name || sock.user.notify || 'Luis-Orvann';

                // Message 2 : Config Render (AVEC LE VRAI ID !!)
                const msg2 = `╭──────────────⬣
│ ⚙️ CONFIG RENDER
╰──────────────⬣

Copiez TOUT ce bloc pour vos variables :

SESSION_ID=${realSessionId}
OWNER_ID=${phoneNumber}
NOM_OWNER=${ownerName}
MODE=private
STICKER_AUTHOR_NAME=${ownerName}
PREFIXE=${prefix}`;

                await sock.sendMessage(myJid, { text: msg2 });
                console.log('📨 MESSAGE AVEC VRAI IDs ENVOYÉ !');
            }
            // else {
            //    console.log('ℹ️ Bot reconnecté (message déjà envoyé)');
            // }
        }
    });

    // 💾 Sauvegarde Crédentials
    sock.ev.on('creds.update', saveCreds);

    // 📤 UPLOAD SESSION VERS SUPABASE (Si connection réussie + pas de SESSION_ID env)
    let hasUploadedSession = false; // Flag pour éviter double upload
    sock.ev.on('connection.update', async (update) => {
        if (update.connection === 'open') {
            // Si on est en local (pas de SESSION_ID env) et qu'on vient de se connecter
            if (!process.env.SESSION_ID && !hasUploadedSession) {
                hasUploadedSession = true; // Verrouiller
                try {
                    const { uploadSessionToSupabase } = await import('./src/utils/supabase-session.js');
                    const myPhone = sock.user.id.split(':')[0];
                    const newSessionId = await uploadSessionToSupabase('./auth_info', myPhone);

                    console.log('\n╭───────────────────────────────────────────────╮');
                    console.log('│ ✅ SESSION SAUVEGARDÉE DANS SUPABASE !        │');
                    console.log('│                                               │');
                    console.log('│ 🔑 VOTRE NOUVEAU SESSION_ID POUR RENDER :     │');
                    console.log(`│ ${newSessionId} │`);
                    console.log('│                                               │');
                    console.log('╰───────────────────────────────────────────────╯\n');
                } catch (err) {
                    console.error('❌ Echec sauvegarde Supabase:', err.message);
                }
            }
        }
    });

    // 📨 Écouter les messages entrants (Handler OVL)
    sock.ev.on('messages.upsert', async (msg) => {
        // Log global pour debug (ACTIVÉ POUR INVESTIGATION VIEWONCE)

        if (msg.messages && msg.messages[0]) {
            const m = msg.messages[0];

            // 🛑 FILTRE TEMPOREL DÉSACTIVÉ (Sur demande utilisateur)
            // Le bot répondra désormais à TOUS les messages reçus, même anciens.

            // 🕵️ DEBUG CRITIQUE FORCE: Voir ce qui arrive VRAIMENT
            const msgKeys = m.message ? Object.keys(m.message) : [];
            const isMsgEmpty = msgKeys.length === 0;

            // ... (Debug logs suppressed)

            // Est-ce une ViewOnce ?
            const isViewOnce = m.message?.viewOnceMessage || m.message?.viewOnceMessageV2 || m.message?.ephemeralMessage?.message?.viewOnceMessage || (m.key && m.key.isViewOnce);

            // Définir 'from' si pas encore défini
            const from = m.key.remoteJid;

            // 🕵️ DEBUG: Log de TOUT message entrant
            // const debugType = m.message ? Object.keys(m.message)[0] : 'No Message Content';

            // ✅ ANTI-DELETE CACHE (Messages + Statuts)
            if (m.message && !m.message.protocolMessage && !m.key.fromMe) {
                messageCache.set(m.key.id, m);

                // Log pour montrer que le message est en cache (utile pour débug)
                const msgType = Object.keys(m.message)[0];
                const senderName = m.pushName || 'Inconnu';
                const isStatus = from === 'status@broadcast';
                const label = isStatus ? '📢 STATUT' : '💾 CACHE';
                console.log(`${label}: Message de ${senderName} (${msgType}) → ID: ${m.key.id.substring(0, 20)}...`);

                setTimeout(() => messageCache.delete(m.key.id), 60 * 60 * 1000);
            }

            // 🔍 DÉTECTION MANUELLE DES SUPPRESSIONS (ProtocolMessage)
            if (m.message && m.message.protocolMessage && m.message.protocolMessage.type === 0) {
                const deletedKey = m.message.protocolMessage.key;

                // ️ DEBUG VALUES
                console.log(`🗑️ CHECK: MsgKey.fromMe=${deletedKey.fromMe}, RevokeKey.fromMe=${m.key.fromMe}`);

                // 🔒 SECURE: On ignore les actions venant de MOI (Revoke envoyé par moi)
                // Si m.key.fromMe est true, c'est moi qui ai cliqué sur "Supprimer pour tous". On ignore.
                if (m.key.fromMe) return;

                // 💚 AUTO-LIKE STATUS (Optimisé)
                if (m.key.remoteJid === 'status@broadcast' && !m.key.fromMe) {
                    const { UserConfig } = await import('./src/database/schema.js');
                    const ownerId = sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net';

                    // Récupérer la config
                    const config = await UserConfig.findOne({ where: { jid: ownerId } }) || { autoLikeStatus: true, likeEmoji: '💚' };

                    if (config.autoLikeStatus) {
                        try {
                            // 1. Marquer comme vu
                            await sock.readMessages([m.key]);

                            // 2. Envoyer la réaction (Liker)
                            // Note: Pour réagir à un statut, il faut utiliser 'status@broadcast' comme JID
                            // et inclure le participant dans statusJidList (si supporté par la lib) ou simplement réagir.
                            // Sur Baileys recent, send react to status requires correct key.

                            await sock.sendMessage('status@broadcast', {
                                react: { text: config.likeEmoji || '💚', key: m.key }
                            }, { statusJidList: [m.key.participant] });

                        } catch (e) {
                            console.error('❌ Auto-Like Failed:', e.message);
                        }
                    }
                    return;
                }

                console.log('🗑️ ANTI-DELETE: Suppression par autrui détectée !');

                try {
                    const { UserConfig } = await import('./src/database/schema.js');
                    const ownerJid = sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net';

                    const cachedMsg = messageCache.get(deletedKey.id);

                    if (cachedMsg) {
                        // Récupérer la config pour les settings
                        const configAD = await UserConfig.findOne({ where: { jid: ownerJid } });
                        const settings = JSON.parse(configAD?.antidelete || '{}');

                        // STRICT CHECK
                        const isGroup = deletedKey.remoteJid.endsWith('@g.us');
                        const isStatus = deletedKey.remoteJid === 'status@broadcast';
                        const isPrivate = !isGroup && !isStatus;

                        let shouldNotify = false;
                        if (settings.all) shouldNotify = true;
                        else {
                            if (isPrivate && settings.pm) shouldNotify = true;
                            if (isGroup && settings.gc) shouldNotify = true;
                            if (isStatus && settings.status) shouldNotify = true;
                        }

                        if (!shouldNotify) {
                            return; // Silencieux
                        }

                        const { toBold } = await import('./src/utils/textStyle.js');
                        const senderName = cachedMsg.pushName || 'Inconnu';
                        const senderNum = deletedKey.participant ? deletedKey.participant.split('@')[0] : deletedKey.remoteJid.split('@')[0];
                        const typeLabel = isStatus ? 'Statut' : (isGroup ? 'Groupe' : 'Privé');
                        const msgType = Object.keys(cachedMsg.message)[0];

                        // Style OVL (Box)
                        let notifText = `╭───〔 🗑️ ANTI-DELETE 〕───⬣\n`;
                        notifText += `│ ߷ *Auteur*  ➜ ${senderName}\n`;

                        // Infos Groupe & Deleter
                        // Dans un UPSERT (Revoke), m.key.participant est celui qui a FAIT l'action (Le Suppresseur)
                        // deletedKey.participant est l'auteur du message original
                        if (isGroup) {
                            const groupMetadata = await sock.groupMetadata(deletedKey.remoteJid).catch(e => { });
                            const groupName = groupMetadata?.subject || 'Groupe Inconnu';

                            // Le deleter est celui qui a envoyé le protocole message
                            const deleterId = m.key.participant || m.key.remoteJid;
                            const deleterNum = deleterId ? deleterId.split('@')[0] : '?';

                            // Logique Nom du Suppresseur
                            let deleterLabel = `@${deleterNum}`;
                            if (deleterNum === senderNum) {
                                deleterLabel = senderName; // C'est l'auteur lui-même
                            } else {
                                deleterLabel = `Admin (@${deleterNum})`; // C'est un admin ou autre
                            }

                            notifText += `│ ߷ *Groupe*  ➜ ${groupName}\n`;
                            notifText += `│ ߷ *Delete*  ➜ ${deleterLabel}\n`;
                        }

                        notifText += `│ ߷ *Heure*   ➜ ${new Date().toLocaleTimeString('fr-FR')}\n`;
                        notifText += `│ ߷ *Type*    ➜ ${typeLabel}\n`;

                        // Logique Contenu / Média
                        let contentText = '';
                        let isMedia = false;

                        if (msgType === 'conversation') contentText = cachedMsg.message.conversation;
                        else if (msgType === 'extendedTextMessage') contentText = cachedMsg.message.extendedTextMessage?.text;
                        else if (msgType === 'imageMessage') { isMedia = true; contentText = cachedMsg.message.imageMessage?.caption; }
                        else if (msgType === 'videoMessage') { isMedia = true; contentText = cachedMsg.message.videoMessage?.caption; }
                        else if (msgType === 'audioMessage') { isMedia = true; }
                        else if (msgType === 'stickerMessage') { isMedia = true; }
                        else if (msgType === 'documentMessage') { isMedia = true; }

                        // Si texte pur, on l'ajoute à la box et on envoie
                        if (!isMedia) {
                            if (contentText) notifText += `│ ߷ *Message* ➜ ${contentText}\n`;
                            notifText += `╰──────────────⬣`;
                            await sock.sendMessage(ownerJid, { text: notifText, mentions: [deletedKey.participant || deletedKey.remoteJid] });
                        }
                        // Si Média, télécharger et renvoyer avec caption (OVL STYLE)
                        else {
                            notifText += `╰──────────────⬣\n`;
                            if (contentText) notifText += `\n📝 *Légende originale :*\n${contentText}`;

                            const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

                            try {
                                const buffer = await downloadMediaMessage(
                                    { key: cachedMsg.key, message: cachedMsg.message },
                                    'buffer',
                                    {},
                                    { logger: console }
                                );

                                if (buffer) {
                                    const mediaType = msgType === 'imageMessage' ? 'image' :
                                        msgType === 'videoMessage' ? 'video' :
                                            msgType === 'audioMessage' ? 'audio' :
                                                msgType === 'stickerMessage' ? 'sticker' : 'document';

                                    const msgOptions = { [mediaType]: buffer };

                                    // CRITICAL: Caption si supporté (Image/Video/Document)
                                    if (mediaType === 'image' || mediaType === 'video' || mediaType === 'document') {
                                        msgOptions.caption = notifText;
                                        await sock.sendMessage(ownerJid, msgOptions);
                                    } else {
                                        // Audio/Sticker: Texte puis média
                                        await sock.sendMessage(ownerJid, { text: notifText, mentions: [deletedKey.participant || deletedKey.remoteJid] });
                                        if (mediaType === 'audio') msgOptions.mimetype = 'audio/mp4';
                                        await sock.sendMessage(ownerJid, msgOptions);
                                    }
                                }
                            } catch (errDl) {
                                console.error('❌ Download media failed:', errDl);
                                await sock.sendMessage(ownerJid, { text: notifText + '\n\n⚠️ Média non disponible', mentions: [deletedKey.participant || deletedKey.remoteJid] });
                            }
                        }

                    }
                    if (cachedMsg) {
                        // ... block content ...
                    } else {
                        console.log(`⚠️ Anti-Delete: Message [${deletedKey.id}] non trouvé en cache (Bot éteint lors de la réception ?)`);
                    }
                } catch (e) {
                    console.error('❌ Erreur Anti-Delete Upsert:', e);
                }
                return;
            }

            // 🛑 GLOBAL IGNORE OLD MESSAGES (DÉSACTIVÉ POUR DEBUG)
            // const msgTime = m.messageTimestamp;
            // const bootTime = Math.floor(Date.now() / 1000) - Math.floor(process.uptime());
            // if (msgTime && msgTime < bootTime) {
            //      console.log(`⏳ Ignored old msg: ${msgTime} < ${bootTime}`);
            //      return;
            // }

            try {
                console.log('➡️ Appel OVLHandler...');
                await OVLHandler(sock, msg);
            } catch (e) {
                console.error('❌ Erreur OVLHandler:', e);
            }

            // 🗄️ CACHE AGRESSIF POUR ANTI-DELETE & VIEWONCE
            // IMPORTANT: Stocker TOUS les messages, y compris les vues uniques sans contenu initial
            // 🔥 STOCKAGE IMMÉDIAT DES VIEW ONCE (CRITIQUE pour éviter l'expiration)
            // Si c'est une View Once, extraire et stocker le contenu média IMMÉDIATEMENT
            let viewOnceContent = null;
            if (isViewOnce && m.message) {
                try {
                    // Extraire le contenu View Once immédiatement avant qu'il n'expire
                    const normalized = normalizeMessageContent(m.message);
                    if (normalized) {
                        const extracted = extractMessageContent(normalized);
                        if (extracted && (extracted.imageMessage || extracted.videoMessage)) {
                            viewOnceContent = {
                                type: extracted.imageMessage ? 'imageMessage' : 'videoMessage',
                                content: extracted.imageMessage || extracted.videoMessage
                            };
                            // Log désactivé pour réduire le spam
                        }
                    }
                } catch (extractErr) {
                    // Erreur silencieuse pour éviter les logs excessifs
                }
            }

            // Stocker le message avec toutes ses données (cache amélioré)
            // IMPORTANT: Stocker le message ORIGINAL (m.message) pas juste realMessage qui peut être vide
            const realMessage = m.message?.ephemeralMessage?.message || m.message || {};
            const messageToStore = (m.message && Object.keys(m.message).length > 0) ? m.message : realMessage;

            // Si le message est vide, on stocke quand même les métadonnées pour la mise à jour future
            messageCache.set(m.key.id, {
                key: m.key,
                message: messageToStore, // Message original pour View Once
                messageTimestamp: m.messageTimestamp || Math.floor(Date.now() / 1000),
                pushName: m.pushName || 'Inconnu',
                isViewOnce: isViewOnce,
                rawData: msg.messages[0], // Sauvegarder les données brutes pour récupération ultérieure
                viewOnceContent: viewOnceContent // Contenu extrait immédiatement (évite l'expiration)
            });

            // Stocker aussi avec l'ID de base (sans suffixe) pour faciliter la recherche
            if (m.key.id.includes('-')) {
                const baseId = m.key.id.split('-')[0];
                messageCache.set(baseId, {
                    key: m.key,
                    message: messageToStore, // Utiliser le même message
                    messageTimestamp: m.messageTimestamp || Math.floor(Date.now() / 1000),
                    pushName: m.pushName || 'Inconnu',
                    isViewOnce: isViewOnce,
                    rawData: msg.messages[0],
                    viewOnceContent: viewOnceContent
                });
            }

            // Logs désactivés pour réduire le spam terminal
        }
    });

    // 🔄 Écouter les mises à jour de messages (CRITIQUE pour ViewOnce vides au départ)
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            // Log update debug (Désactivé)
            // console.log(`🔄 UPDATE RAW [${update.key.id}]:`, Object.keys(update.update || {}));

            if (update.update && update.update.message) {
                const msgId = update.key.id;
                // console.log(`🔄 UPDATE CONTENT DETECTÉ pour ${msgId}`);

                // Mettre à jour le cache si le message existe déjà
                if (messageCache.has(msgId)) {
                    const cached = messageCache.get(msgId);

                    // Fusionner le nouveau contenu
                    cached.message = update.update.message;

                    // Recalculer ViewOnce Content si nécessaire
                    if (cached.isViewOnce && !cached.viewOnceContent) {
                        try {
                            const normalized = normalizeMessageContent(cached.message);
                            if (normalized) {
                                const extracted = extractMessageContent(normalized);
                                if (extracted && (extracted.imageMessage || extracted.videoMessage)) {
                                    cached.viewOnceContent = {
                                        type: extracted.imageMessage ? 'imageMessage' : 'videoMessage',
                                        content: extracted.imageMessage || extracted.videoMessage
                                    };
                                    console.log(`✅ ViewOnce UPDATE: Contenu récupéré après coup pour ${msgId}`);
                                }
                            }
                        } catch (e) { }
                    }

                    messageCache.set(msgId, cached);
                } else {
                    // Si pas en cache (ex: message arrivé avant start), on pourrait le créer ?
                    // Pour l'instant on log juste
                    console.log(`⚠️ Update pour message inconnnu du cache: ${msgId}`);
                }
            }
        }
    });

    // 📜 HISTORY SYNC (Pour les messages arrivant par sync)
    sock.ev.on('messaging-history.set', async ({ messages, isLatest }) => {
        if (messages && messages.length > 0) {
            console.log(`📜 HISTORY SYNC: ${messages.length} messages reçus.`);
            // On peut scanner ces messages pour des ViewOnce qu'on aurait ratés
            // Mais généralement c'est au démarrage.
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

                if (!cachedMsg) {
                    continue; // Silencieux
                }

                // STRICT CHECK
                const isGroup = deletedKey.remoteJid.endsWith('@g.us');
                const isStatus = deletedKey.remoteJid === 'status@broadcast';
                const isPrivate = !isGroup && !isStatus;

                let shouldNotify = false;
                if (settings.all) shouldNotify = true;
                else {
                    if (isPrivate && settings.pm) shouldNotify = true;
                    if (isGroup && settings.gc) shouldNotify = true;
                    if (isStatus && settings.status) shouldNotify = true;
                }

                if (!shouldNotify) {
                    continue; // Silencieux
                }

                const { toBold } = await import('./src/utils/textStyle.js');
                const senderName = cachedMsg.pushName || 'Inconnu';
                const senderNum = deletedKey.participant ? deletedKey.participant.split('@')[0] : deletedKey.remoteJid.split('@')[0];
                const typeLabel = isStatus ? 'Statut' : (isGroup ? 'Groupe' : 'Privé');
                const msgType = Object.keys(cachedMsg.message)[0];

                // CONSTRUCTION DU TEXTE OVL (Box Style)
                let notifText = `╭───〔 🗑️ ANTI-DELETE 〕───⬣\n`;
                notifText += `│ ߷ *Auteur*  ➜ ${senderName}\n`;

                // Infos Groupe & Deleter
                if (isGroup) {
                    const groupMetadata = await sock.groupMetadata(deletedKey.remoteJid).catch(e => { });
                    const groupName = groupMetadata?.subject || 'Groupe Inconnu';

                    // Pour l'event delete, on a souvent que les clés.
                    // On tente de deviner mais c'est moins fiable que l'upsert
                    // Si supprimé par soi-même (common case in event), c'est souvent l'auteur.
                    // Mais si admin delete, c'est dur à savoir ici.
                    // On affiche "Supprimé par" seulement si on a l'info sûre, sinon on met "Inconnu/Lui-même"

                    notifText += `│ ߷ *Groupe*  ➜ ${groupName}\n`;
                    // notifText += `│ ߷ *Supprimé par* ➜ (Voir logs)\n`; // On évite de dire n'importe quoi ici
                }

                notifText += `│ ߷ *Heure*   ➜ ${new Date().toLocaleTimeString('fr-FR')}\n`;
                notifText += `│ ߷ *Type*    ➜ ${typeLabel}\n`;

                let contentText = '';
                let isMedia = false;

                if (msgType === 'conversation') contentText = cachedMsg.message.conversation;
                else if (msgType === 'extendedTextMessage') contentText = cachedMsg.message.extendedTextMessage?.text;
                else if (msgType === 'imageMessage') { isMedia = true; contentText = cachedMsg.message.imageMessage?.caption; }
                else if (msgType === 'videoMessage') { isMedia = true; contentText = cachedMsg.message.videoMessage?.caption; }
                else if (msgType === 'audioMessage') { isMedia = true; }
                else if (msgType === 'stickerMessage') { isMedia = true; }
                else if (msgType === 'documentMessage') { isMedia = true; }

                // Si texte pur
                if (!isMedia) {
                    if (contentText) notifText += `│ ߷ *Message* ➜ ${contentText}\n`;
                    notifText += `╰──────────────⬣`;
                    await sock.sendMessage(ownerJid, { text: notifText, mentions: [deletedKey.participant || deletedKey.remoteJid] });
                }
                // Si Média
                else {
                    notifText += `╰──────────────⬣\n`;
                    if (contentText) notifText += `\n📝 *Légende originale :*\n${contentText}`;

                    const msgContent = JSON.parse(JSON.stringify(cachedMsg.message));
                    const specificContent = msgContent[msgType];

                    if (specificContent) {
                        specificContent.caption = notifText;
                        const hasCaptionSupport = (msgType === 'imageMessage' || msgType === 'videoMessage' || msgType === 'documentMessage');

                        if (hasCaptionSupport) {
                            await sock.sendMessage(ownerJid, { forward: { key: cachedMsg.key, message: msgContent } }, { caption: notifText });
                        } else {
                            await sock.sendMessage(ownerJid, { text: notifText, mentions: [deletedKey.participant || deletedKey.remoteJid] });
                            await sock.sendMessage(ownerJid, { forward: { key: cachedMsg.key, message: cachedMsg.message } });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erreur Anti-Delete:', error);
        }
    });

    // 👁️ VIEWONCE SAVE VIA REACTION (Groups & Private) - LOGIQUE IDENTIQUE À .vv
    sock.ev.on('messages.reaction', async (reactions) => {
        try {
            const reaction = reactions[0];
            if (!reaction || !reaction.key.remoteJid) return;
            if (!reaction.reaction || !reaction.reaction.text) return;

            const emoji = reaction.reaction.text;
            if (emoji !== '👁️' && emoji !== '👀' && emoji !== '💾') return;

            console.log(`👁️ REACTION DETECTED: ${emoji} on ${reaction.key.id}`); // DEBUG

            const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const recipientJid = ownerJid;

            // Chercher le message dans le cache (essayer plusieurs formats d'ID)
            const msgId = reaction.key.id;
            let cachedMsg = messageCache.get(msgId);
            if (!cachedMsg && msgId.includes('-')) {
                const baseId = msgId.split('-')[0];
                cachedMsg = messageCache.get(baseId);
            }
            if (!cachedMsg) {
                // Recherche récursive (un peu plus coûteuse mais nécessaire parfois)
                for (const [cacheId, cacheMsg] of messageCache.entries()) {
                    if (cacheId === msgId || cacheId.startsWith(msgId) || msgId.startsWith(cacheId) ||
                        (cacheId.includes('-') && cacheId.split('-')[0] === msgId)) {
                        cachedMsg = cacheMsg;
                        break;
                    }
                }
            }

            if (!cachedMsg) {
                console.log(`❌ ViewOnce: Message non trouvé dans le cache (${msgId})`); // DEBUG
                // SILENCE: Ne pas spammer l'utilisateur sur des vieux messages
                // await sock.sendMessage(recipientJid, {
                //    text: `⚠️ Vue unique non trouvée dans le cache.\n\n💡 Utilisez .vv en réponse au message pour la récupérer.`
                // }).catch(() => { });
                return;
            }

            console.log(`✅ ViewOnce: Message trouvé ! Type content: ${cachedMsg.viewOnceContent ? 'PRE-SAVED' : 'RAW'}`); // DEBUG

            // 🔥 MÉTHODE EXACTE COMME .vv : Utiliser handleManualViewOnce directement
            try {
                const { handleManualViewOnce } = await import('./src/handlers/ovl_handler.js');

                // Priorité 1: Utiliser viewOnceContent si disponible (plus fiable)
                if (cachedMsg.viewOnceContent) {
                    console.log('📥 ViewOnce: Téléchargement via contenu pré-sauvegardé...'); // DEBUG
                    const msgToDownload = {
                        key: cachedMsg.key,
                        message: { [cachedMsg.viewOnceContent.type]: cachedMsg.viewOnceContent.content }
                    };

                    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
                    const buffer = await downloadMediaMessage(msgToDownload, 'buffer', {}, { logger: pino({ level: 'silent' }) });

                    if (buffer && buffer.length > 0) {
                        const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                        const caption = `👁️ *Vue Unique Récupérée*\n\nDe: ${cachedMsg.pushName || 'Inconnu'}`;

                        if (cachedMsg.viewOnceContent.type === 'imageMessage') {
                            await sock.sendMessage(myJid, { image: buffer, caption });
                        } else if (cachedMsg.viewOnceContent.type === 'videoMessage') {
                            await sock.sendMessage(myJid, { video: buffer, caption });
                        }
                        console.log('✅ ViewOnce: Envoyé avec succès !'); // DEBUG
                        return;
                    } else {
                        console.log('❌ ViewOnce: Buffer vide après téléchargement'); // DEBUG
                    }
                }

                // Priorité 2: Extraire depuis le message brut (comme .vv)
                const messageObj = cachedMsg.message || cachedMsg.rawData?.message || {};

                // 🕵️ DEBUG CRITIQUE : Voir la structure exacte du message en cache
                console.log('📦 CACHE DUMP:', JSON.stringify(messageObj, null, 2));

                const viewOnceMsg = messageObj.viewOnceMessage || messageObj.viewOnceMessageV2 ||
                    messageObj.ephemeralMessage?.message?.viewOnceMessage ||
                    messageObj.ephemeralMessage?.message?.viewOnceMessageV2;

                if (!viewOnceMsg) {
                    // SILENCE: Ne pas spammer si ce n'est pas une vue unique (réactions parasites)
                    // await sock.sendMessage(recipientJid, {
                    //     text: `⚠️ Ce message n'est pas une vue unique ou le contenu a expiré.\n\n💡 Utilisez .vv en réponse au message.`
                    // }).catch(() => { });
                    return;
                }

                // Utiliser handleManualViewOnce avec la structure exacte de .vv
                const actualMsg = viewOnceMsg.message || viewOnceMsg;

                // DEBUG STRUCTURE
                console.log('🔍 VIEWONCE DEBUG: Keys of actualMsg:', Object.keys(actualMsg));
                if (actualMsg.imageMessage) console.log('   -> Found imageMessage');
                if (actualMsg.videoMessage) console.log('   -> Found videoMessage');

                if (!actualMsg) {
                    throw new Error('Contenu View Once introuvable');
                }

                // Créer une structure de message similaire à une réponse (comme .vv attend)
                const fakeMessage = {
                    key: cachedMsg.key,
                    message: {
                        extendedTextMessage: {
                            contextInfo: {
                                quotedMessage: {
                                    viewOnceMessage: viewOnceMsg.viewOnceMessage || viewOnceMsg,
                                    viewOnceMessageV2: viewOnceMsg.viewOnceMessageV2 || viewOnceMsg
                                }
                            }
                        }
                    }
                };

                await handleManualViewOnce(sock, fakeMessage, actualMsg);
            } catch (vvErr) {
                await sock.sendMessage(recipientJid, {
                    text: `❌ Erreur lors de la récupération: ${vvErr.message || 'Erreur inconnue'}\n\n💡 Essayez d'utiliser .vv en réponse au message.`
                }).catch(() => { });
            }
        } catch (e) {
            // Erreur silencieuse pour éviter les logs excessifs
        }
    });

    // (Gestion connection.update centralisée plus haut)

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

// Fin du script
