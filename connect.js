import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import { encodeSession } from './src/utils/session-handler.js';
import { uploadSessionToSupabase } from './src/utils/supabase-session.js';
import fs from 'fs';

const BOT_CONFIG = {
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    printQRInTerminal: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000
};

console.clear();
console.log('╭──────────────────────────────────╮');
console.log('│   🤖 WBOT - AUTHENTIFICATION     │');
console.log('╰──────────────────────────────────╯\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(resolve => rl.question(q, resolve));

async function startSocket(usePairing, phoneNumber) {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }),
        ...BOT_CONFIG
    });

    if (usePairing && !sock.authState.creds.registered) {
        console.log('\n⏳ Génération du code...');
        await delay(2000);
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\n🔑 CODE : ${code?.match(/.{1,4}/g)?.join('-') || code}`);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !usePairing) {
            console.log('\n📷 QR Code généré ! Scannez avec WhatsApp:\n');
            const qrcodeModule = await import('qrcode-terminal');
            qrcodeModule.default.generate(qr, { small: true });
            console.log('');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;

            if (reason !== DisconnectReason.loggedOut) {
                // Reconnexion silencieuse pour stabilité
                console.log('🔄 Reconnexion...');
                setTimeout(() => startSocket(usePairing, phoneNumber), 3000);
            } else {
                console.log('⚠️ Session invalidée (Logged Out).');
                console.log('🧹 Nettoyage et nouvelle tentative...');
                // Retry from scratch
                fs.rmSync('./auth_info', { recursive: true, force: true });
                setTimeout(() => startSocket(usePairing, phoneNumber), 1000);
            }
        }

        if (connection === 'open') {
            console.log('\n✅ CONNEXION RÉUSSIE !');
            console.log('📁 Envoi de la session sur Supabase (Short ID)...');

            try {
                // 1. Upload Supabase SQL (Upload Strict, pas de fallback local)
                let sessionId;
                try {
                    const myPhone = sock.user.id.split(':')[0];
                    sessionId = await uploadSessionToSupabase('./auth_info', myPhone);
                    console.log(`✅ Session Secure ID généré : ${sessionId}`);
                } catch (err) {
                    console.error('❌ ERREUR CRITIQUE SUPABASE:', err.message);
                    console.log('⚠️ Impossible de sauvegarder la session en base. Vérifiez votre connexion internet.');
                    process.exit(1); // On arrête car sans Supabase, le bot ne marchera pas sur Render
                }

                // 2. Préparation du message unique de configuration
                const realOwnerName = sock.user.name || sock.user.notify || 'Utilisateur'; // Nom WhatsApp
                const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                const ownerNumber = sock.user.id.split(':')[0];

                // 3. Envoyer le message (SIMPLE, SANS VARIABLES)
                const finalMessage = `✅ *WBOT CONNECTÉ AVEC SUCCÈS !*`;
                await sock.sendMessage(myJid, { text: finalMessage });

                console.log('📨 MESSAGE DE CONFIGURATION ENVOYÉ !');
                console.log('✅ Session sécurisée et prête.');
                console.log('👋 Arrêt automatique dans 5 secondes...');

                await delay(5000);
                process.exit(0);

            } catch (e) {
                console.error('Erreur finale:', e);
                process.exit(1);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

async function main() {
    try {
        console.log('📋 Méthode de connexion :');
        console.log('1️⃣  QR Code (Scanner) [DABORD MOI !]');
        console.log('2️⃣  Pairing Code (Si QR échoue)');

        const choice = await question('\nVotre choix (1/2) : ');
        const usePairing = choice.trim() === '2';

        let phoneNumber = '';
        if (usePairing) {
            phoneNumber = await question('\n📱 Numéro (ex: 229xxxxxxxx) : ');
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        }

        startSocket(usePairing, phoneNumber);

    } catch (e) {
        console.error(e);
    }
}

main();
