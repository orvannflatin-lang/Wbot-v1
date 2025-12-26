import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import readline from 'readline';
import { encodeSession } from './src/utils/session-handler.js';

/**
 * Script simple de connexion WhatsApp - Style OVL
 * Génère QR code OU pairing code selon votre choix
 */

console.clear();
console.log('╭──────────────────────────────────╮');
console.log('│     🤖 WBOT - Connexion WA      │');
console.log('│         Style OVL Simple         │');
console.log('╰──────────────────────────────────╯\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function connectWhatsApp() {
    try {
        console.log('📋 Choisissez votre méthode de connexion:\n');
        console.log('1️⃣  QR Code (scanner avec téléphone)');
        console.log('2️⃣  Pairing Code (code à 8 chiffres)\n');

        const choice = await question('Votre choix (1 ou 2): ');
        const useQR = choice.trim() === '1';

        let phoneNumber = null;
        if (!useQR) {
            phoneNumber = await question('\n📱 Entrez votre numéro WhatsApp (ex: 22963062969): ');
            phoneNumber = phoneNumber.trim();
        }

        console.log('\n⏳ Connexion en cours...\n');

        // Créer l'authentification
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

        // Créer le socket WhatsApp
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Desktop"),
            markOnlineOnConnect: false,
            syncFullHistory: false
        });

        let connected = false;
        let ownerJid = null;

        // Événement: Connexion
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && useQR) {
                console.log('\n📷 Scannez ce QR code avec WhatsApp:\n');
                qrcode.generate(qr, { small: true });
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('Scannez depuis: Paramètres → Appareils connectés');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('\n❌ Connexion fermée. Reconnexion:', shouldReconnect);

                if (!shouldReconnect) {
                    process.exit(0);
                }
            }

            if (connection === 'open') {
                connected = true;
                ownerJid = sock.user.id;

                console.log('\n╭──────────────────────────────────╮');
                console.log('│   ✅ CONNEXION RÉUSSIE !        │');
                console.log('╰──────────────────────────────────╯\n');
                console.log('👤 Votre JID:', ownerJid);

                // Encoder la session
                console.log('\n⏳ Encodage de votre session...');
                const sessionId = encodeSession('./auth_info');

                console.log('\n╭──────────────────────────────────────────────╮');
                console.log('│  📋 VOTRE SESSION_ID POUR RENDER            │');
                console.log('╰──────────────────────────────────────────────╯\n');
                console.log('Copiez cette ligne pour Render:\n');
                console.log('SESSION_ID=' + sessionId);
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                // Envoyer sur WhatsApp aussi
                const message = `╭──────────────⬣
│ ✅ *WBOT CONNECTÉ*
╰──────────────⬣

Votre SESSION_ID pour Render:

\`\`\`
SESSION_ID=${sessionId}
\`\`\`

*Étapes:*
1. Aller sur render.com
2. New + → Web Service
3. Connecter votre repo GitHub
4. Ajouter cette variable
5. Deploy ! 🚀

*WBOT v1.0* - Luis-Orvann`;

                await delay(1000);
                await sock.sendMessage(ownerJid, { text: message });

                console.log('✅ SESSION_ID aussi envoyée sur votre WhatsApp!\n');
                console.log('Vous pouvez maintenant fermer ce script (Ctrl+C)');
                console.log('ou le laisser tourner pour tester le bot.\n');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Si pairing code
        if (!useQR && phoneNumber) {
            console.log('⏳ Génération du code de pairage...\n');
            await delay(3000);

            const code = await sock.requestPairingCode(phoneNumber);

            console.log('╭──────────────────────────────────╮');
            console.log('│   🔑 VOTRE CODE DE PAIRAGE      │');
            console.log('╰──────────────────────────────────╯\n');
            console.log('           ' + code + '\n');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('Instructions:');
            console.log('1. Ouvrez WhatsApp');
            console.log('2. Paramètres → Appareils connectés');
            console.log('3. Connecter un appareil');
            console.log('4. Connecter avec numéro');
            console.log('5. Entrez: ' + code);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }

    } catch (error) {
        console.error('\n❌ Erreur:', error.message);
        process.exit(1);
    }
}

// Gestion propre de la fermeture
process.on('SIGINT', () => {
    console.log('\n\n👋 Au revoir!');
    rl.close();
    process.exit(0);
});

// Démarrer
connectWhatsApp().catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
});
