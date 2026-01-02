import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    delay,
    normalizeMessageContent,
    extractMessageContent
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import { startApiServer } from './src/api/server.js';
import { initDatabase } from './src/database/schema.js';
import { OVLHandler } from './src/handlers/ovl_handler.js';

const PORT = process.env.PORT || 3000;

// 🔧 FIX: Flag pour éviter les messages de bienvenue répétés
let welcomeMessageSent = false;

// 🗄️ Cache amélioré pour stocker les messages (Anti-Delete + View Once)
// Structure: { key, message, messageTimestamp, pushName, isViewOnce, rawData, viewOnceContent }
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
        syncFullHistory: true, // ACTIVE: Force la synchro complète pour récupérer le contenu manquant (ViewOnce)
        markOnlineOnConnect: true, // ACTIVE: Être "Visible" aide à la réception des messages
        generateHighQualityLinkPreview: true
    });

    // Note: Pas de store Baileys dans cette version, utilisation du cache Map amélioré

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

                // Récupération du VRAI nom WhatsApp
                const realOwnerName = sock.user.name || sock.user.notify || 'Utilisateur';

                // 🔧 FIX: Générer SESSION_ID
                const generateShortId = () => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                    let id = 'WBOT~';
                    for (let i = 0; i < 8; i++) {
                        id += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    return id;
                };
                const sessionId = generateShortId();

                // Message 2: UNIQUE MESSAGE DE CONFIGURATION (Tout-en-un)
                const msgConfig = `╭──────────────⬣
│ ⚙️ *CONFIG RENDER*
╰──────────────⬣

Copiez TOUT ce bloc pour vos variables :

\`\`\`
SESSION_ID=${sessionId}
OWNER_ID=${phoneNumber}
NOM_OWNER=${realOwnerName}
MODE=private
STICKER_AUTHOR_NAME=${realOwnerName}
PREFIXE=.
GEMINI_API_KEY=(Votre Clé Ici)
\`\`\`

⚠️ *INSTRUCTIONS* :
1. Allez sur Render > Blueprint > New
2. Connectez GitHub
3. Collez ce SESSION_ID quand demandé (ou remplissez les champs manuels)
4. Deploy ! 🚀`;

                // Envoyer les messages
                await sock.sendMessage(myJid, { text: msgInfo });
                await delay(1000);
                await sock.sendMessage(myJid, { text: msgConfig });

                console.log('📨 Messages de bienvenue (et SessionID) envoyés');

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
        // Log global pour debug (ACTIVÉ POUR INVESTIGATION VIEWONCE)

        if (msg.messages && msg.messages[0]) {
            const m = msg.messages[0];

            // 🕵️ DEBUG CRITIQUE FORCE: Voir ce qui arrive VRAIMENT
            const msgKeys = m.message ? Object.keys(m.message) : [];
            const isMsgEmpty = msgKeys.length === 0;

            console.log(`📥 UPSERT DEBUG [${m.key.id}]: Keys=${JSON.stringify(msgKeys)} fromMe=${m.key.fromMe}`);

            if (isMsgEmpty || msgKeys[0] === 'vide') {
                console.log('🚨 ALERT: Message vide reçu ! Dump complet de l\'objet m :');
                console.log(JSON.stringify(m, null, 2));
            }

            // Est-ce une ViewOnce ? (Logs désactivés pour réduire le spam)
            const isViewOnce = m.message?.viewOnceMessage || m.message?.viewOnceMessageV2 || m.message?.ephemeralMessage?.message?.viewOnceMessage || (m.key && m.key.isViewOnce);

            // DEBUG: Si ViewOnce, on veut voir ce qui arrive
            if (isViewOnce) {
                console.log('📥 UPSERT PROCESSED VIEWONCE:', m.key.id);
                // console.log('   -> Message Keys:', Object.keys(m.message || {}));
            }

            // 🕵️ DEBUG: Log de TOUT message entrant (ID + RemoteJid + Type)
            const debugType = m.message ? Object.keys(m.message)[0] : 'No Message Content';
            // console.log(`🕵️ MSG REÇU [${m.key.remoteJid}]: ${m.key.id} | Type: ${debugType} | Participant: ${m.key.participant}`);

            // DEBUG AUTO-LIKE: Vérifier si c'est un statut (log réduit)
            // if (m.key.remoteJid === 'status@broadcast') {
            //     console.log(`💚 STATUS REÇU ! De: ${m.key.participant} | ID: ${m.key.id}`);
            // }

            // 🔍 DÉTECTION MANUELLE DES SUPPRESSIONS (ProtocolMessage)
            // Car l'event messages.delete ne se déclenche pas toujours pour les autres
            if (m.message && m.message.protocolMessage && m.message.protocolMessage.type === 0) { // TYPE 0 = REVOKE
                console.log('🗑️ DÉTECTION REVOKE VIA UPSERT:', m.key.id);
                const deletedKey = m.message.protocolMessage.key;

                // On déclenche manuellement la logique Anti-Delete
                // On simule l'objet deletion pour réutiliser le code ou on le copie ici
                // Pour faire simple et vite, on copie la logique critique ici
                try {
                    const { UserConfig } = await import('./src/database/schema.js');
                    const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

                    const cachedMsg = messageCache.get(deletedKey.id);
                    if (cachedMsg) {
                        const config = await UserConfig.findOne({ where: { jid: ownerJid } });

                        if (!config || !config.antidelete) return;
                        const settings = JSON.parse(config.antidelete);

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
                        // Si Média, on envoie le média AVEC la box en légende
                        else {
                            notifText += `╰──────────────⬣\n`;
                            if (contentText) notifText += `\n📝 *Légende originale :*\n${contentText}`;

                            // On clone le message pour ne pas modifier le cache
                            const msgContent = JSON.parse(JSON.stringify(cachedMsg.message));
                            const specificContent = msgContent[msgType];

                            // On injecte notre texte OVL en caption/contexInfo
                            if (specificContent) {
                                specificContent.caption = notifText;
                                // Pour les stickers/audio qui n'ont pas de caption, on envoie le texte d'abord puis le média
                                const hasCaptionSupport = (msgType === 'imageMessage' || msgType === 'videoMessage' || msgType === 'documentMessage');

                                if (hasCaptionSupport) {
                                    // Envoi du média modifié (Caption = OVL Info)
                                    await sock.sendMessage(ownerJid, { forward: { key: cachedMsg.key, message: msgContent } }, { caption: notifText });
                                    // Fallback si le forward avec caption ne marche pas comme prévu (certaines libs ignorent caption sur forward)
                                    // Mais testons d'abord. Si ça rate, on verra.
                                    // Alternative: Reconstruire le message
                                    // await sock.sendMessage(ownerJid, { [msgType.replace('Message', '')]: specificContent, caption: notifText });
                                } else {
                                    // Stickers, Vocaux -> Pas de caption possible -> Envoi Texte PUIS Média
                                    await sock.sendMessage(ownerJid, { text: notifText, mentions: [deletedKey.participant || deletedKey.remoteJid] });
                                    await sock.sendMessage(ownerJid, { forward: { key: cachedMsg.key, message: cachedMsg.message } });
                                }
                            }
                        }

                    }
                } catch (e) {
                    console.error('❌ Erreur Anti-Delete Upsert:', e);
                }
                return;
            }

            try {
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
                await sock.sendMessage(recipientJid, {
                    text: `⚠️ Vue unique non trouvée dans le cache.\n\n💡 Utilisez .vv en réponse au message pour la récupérer.`
                }).catch(() => { });
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
                    await sock.sendMessage(recipientJid, {
                        text: `⚠️ Ce message n'est pas une vue unique ou le contenu a expiré.\n\n💡 Utilisez .vv en réponse au message.`
                    }).catch(() => { });
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

    // Gestion de la reconnexion
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Deprecated message handling (kept silent or minimal)
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connexion fermée. Reconnexion:', shouldReconnect);
            if (shouldReconnect) {
                startWBOT();
            }
        } else if (connection === 'open') {
            console.log('✅ WBOT CONNECTÉ À WHATSAPP !');
            const botNumber = sock.user.id.split(':')[0];
            console.log(`🆔 User: ${sock.user.id}`);
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
