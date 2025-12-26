import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import { initDatabase, UserConfig } from './src/database/schema.js';
import { handleMessage } from './src/handlers/message-handler.js';
import { initGhostMode, shouldBlockReadReceipt } from './src/features/ghost-mode.js';
import { restoreScheduledStatuses } from './src/features/status-scheduler.js';
import { addMessage, getMessage } from './src/utils/store-messages.js';
import { handleAntiDelete } from './src/features/antidelete.js';
import config from './src/config/default.js';

let sock;
let ownerJid = null;

/**
 * Point d'entrée principal du bot WBOT
 */
async function startWBOT() {
    console.log('🤖 Démarrage de WBOT...\n');

    // Initialiser la base de données
    const dbReady = await initDatabase();
    if (!dbReady) {
        console.error('❌ Impossible d\'initialiser la base de données');
        process.exit(1);
    }

    // Configurer l'authentification (simplifié comme OVL)
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // Vérifier l'état de la connexion
    console.log('📡 État de la session:', state.creds.registered ? '✅ Inscrite' : '❌ Non inscrite');
    console.log('🔄 Tentative de connexion à WhatsApp...\n');

    // Créer la connexion WhatsApp - Configuration identique à OVL
    // IMPORTANT: Ne pas utiliser try/catch ici car cela peut interférer avec Baileys
    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Desktop"),
        printQRInTerminal: false,
        keepAliveIntervalMs: 10000,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        getMessage: async (key) => {
            const stored = getMessage(key.id);
            return stored?.message || { conversation: '' };
        }
    });

    // Demander le code de pairage si pas de session
    if (!state.creds.registered) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 CONNEXION PAR CODE DE PAIRAGE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Demander le numéro de téléphone
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const phoneNumber = await new Promise(resolve => {
            rl.question('Entrez votre numéro WhatsApp (format international, ex: 22961234567): ', answer => {
                rl.close();
                resolve(answer.trim());
            });
        });

        // Attendre que la connexion soit stable
        console.log('\n⏳ Établissement de la connexion...');
        await delay(3000);

        // Demander le code de pairage
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔑 VOTRE CODE DE PAIRAGE:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(`          ${code}`);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✨ Instructions:');
        console.log('   1. Ouvrez WhatsApp sur votre téléphone');
        console.log('   2. Allez dans Paramètres > Appareils connectés');
        console.log('   3. Appuyez sur "Connecter un appareil"');
        console.log('   4. Choisissez "Connecter avec le numéro de téléphone"');
        console.log(`   5. Entrez le code: ${code}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    // Événement: Connexion
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // État de connexion
        if (connection === 'connecting') {
            console.log('🔄 Connexion en cours...');
            return;
        }

        // Gérer la fermeture de connexion
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('❌ Connexion fermée');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('   Code erreur:', statusCode || 'Inconnu');
            console.log('   Message:', lastDisconnect?.error?.message || lastDisconnect?.error || 'Aucun message');
            console.log('   Reconnexion:', shouldReconnect ? 'OUI' : 'NON');

            // Si c'est une erreur 405, problème réseau - arrêter la boucle infinie
            if (statusCode === 405) {
                console.log('\n⚠️  ERREUR 405 - Connection Failure');
                console.log('   Ce problème indique que votre connexion est bloquée.');
                console.log('   Solutions possibles:');
                console.log('   1. Vérifier que WhatsApp Web fonctionne dans votre navigateur');
                console.log('   2. Désactiver temporairement l\'antivirus');
                console.log('   3. Essayer avec un VPN');
                console.log('   4. Utiliser un autre réseau (4G/5G)');
                console.log('\n🔓 Arrêt du bot pour éviter la boucle infinie.\n');
                process.exit(1);
            }

            // Nettoyer la session si nécessaire
            if (statusCode === 401 || !shouldReconnect) {
                console.log('\n🧹 Nettoyage de la session expirée...');
                try {
                    if (fs.existsSync('./auth_info')) {
                        fs.rmSync('./auth_info', { recursive: true, force: true });
                        console.log('✅ Session nettoyée');
                    }
                } catch (cleanError) {
                    console.error('⚠️ Erreur nettoyage:', cleanError.message);
                }
            }

            if (shouldReconnect && statusCode !== 401 && statusCode !== 405) {
                console.log('\n⏳ Tentative de reconnexion dans 5 secondes...\n');
                await delay(5000);
                startWBOT();
            } else {
                console.log('\n🔓 Déconnecté. Veuillez relancer le bot.\n');
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log('\n✅ Connecté à WhatsApp!');

            // Récupérer le JID du propriétaire
            ownerJid = sock.user.id;
            console.log(`👤 Propriétaire: ${ownerJid}\n`);

            // Créer/mettre à jour le propriétaire en DB
            await UserConfig.findOrCreate({
                where: { jid: ownerJid },
                defaults: {
                    jid: ownerJid,
                    prefix: config.defaultPrefix,
                    isOwner: true,
                    ghostMode: false
                }
            });

            // Initialiser le mode fantôme
            await initGhostMode(ownerJid);

            // Restaurer les statuts programmés
            await restoreScheduledStatuses(sock);

            // Envoyer message de bienvenue (style OVL)
            const welcomeMessage =
                '╭──────────────⬣\n' +
                '│ ߷ *WBOT*\n' +
                '│ ߷ *Mode*      ➜ Public\n' +
                '│ ߷ *Commandes* ➜ Toutes activées\n' +
                '│ ߷ *Version*   ➜ 1.0.0\n' +
                '│ ߷ *Développeur*➜ Luis-Orvann\n' +
                '╰──────────────⬣';

            // Attendre un peu avant d'envoyer le message
            await delay(2000);

            await sock.sendMessage(ownerJid, {
                text: welcomeMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true
                }
            });

            console.log('🚀 WBOT est prêt!\n');
            console.log('💡 Commandes disponibles:');
            console.log('   .help - Aide');
            console.log('   .ghost on/off - Mode fantôme');
            console.log('   .antidelete all/pm/gc/status/off - Anti-suppression');
            console.log('   .dl <url> - Télécharger vidéo');
            console.log('   .schedule - Programmer statut');
            console.log('   Reply à vue unique avec .save');
            console.log('   Reply à statut avec .dlstatus\n');
        }
    });

    // Événement: Mise à jour des credentials
    sock.ev.on('creds.update', saveCreds);

    // Événement: Messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const message of messages) {
            // Stocker le message pour l'antidelete (si il a un ID)
            if (message.key?.id && message.message) {
                addMessage(message.key.id, message);
            }

            // Ignorer les messages de statut broadcast (sauf pour la sauvegarde)
            if (message.key.remoteJid === 'status@broadcast') continue;

            // Traiter le message
            await handleMessage(sock, message, ownerJid);
        }
    });

    // Événement: Accusés de lecture et suppressions (pour Ghost Mode et AntiDelete)
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            // Gérer les suppressions (AntiDelete)
            if (update.update?.protocolMessage?.type === 1) { // Type 1 = REVOKE (suppression)
                await handleAntiDelete(sock, update, ownerJid);
            }

            // Gérer les accusés de lecture (Ghost Mode)
            if (update.update.status === 3) { // Status 3 = read
                const senderJid = update.key.remoteJid;

                // Si Ghost Mode actif, ne pas envoyer l'accusé de lecture
                if (shouldBlockReadReceipt(ownerJid)) {
                    console.log('👻 Ghost Mode: Accusé de lecture bloqué');
                    // Note: Baileys gère automatiquement les read receipts
                    // Pour vraiment bloquer, il faut modifier les settings WhatsApp
                }
            }
        }
    });

    // Événement: Présence (pour Ghost Mode)
    sock.ev.on('presence.update', async ({ id, presences }) => {
        // Gérer la présence si Ghost Mode actif
        if (shouldBlockReadReceipt(ownerJid)) {
            // Rester en mode "unavailable"
            await sock.sendPresenceUpdate('unavailable');
        }
    });
}

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
    console.error('❌ Erreur non capturée:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesse rejetée:', reason);
});


// Export for use in start.js
export default startWBOT;

// Démarrer le bot
startWBOT().catch((err) => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
});
