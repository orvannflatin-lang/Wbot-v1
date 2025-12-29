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
                setTimeout(() => startSocket(usePairing, phoneNumber), 3000);
            } else {
                console.log('❌ Déconnecté (Logged Out).');
                process.exit(0);
            }
        }



        // ... (StartSocket function continues)

        if (connection === 'open') {
            console.log('\n✅ CONNEXION RÉUSSIE !');
            console.log('📁 Envoi de la session sur Supabase (Short ID)...');

            try {
                // 1. Upload Supabase pour avoir un ID court
                const shortId = await uploadSessionToSupabase('./auth_info');
                console.log(`✅ Session ID généré : ${shortId}`);

                // 2. Message 1 : Bienvenue Style ASCII OVL (mais White Label)
                const msgInfo = `╭───〔 🤖 WBOT 〕───⬣
│ ߷ Etat       ➜ Connecté ✅
│ ߷ Préfixe    ➜ .
│ ߷ Mode       ➜ private
│ ߷ Commandes  ➜ 10
│ ߷ Version    ➜ 1.0.0
│ ߷ *Développeur*➜ Luis Orvann
╰──────────────⬣`;

                // 3. Message 2 : Bloc Variables ENV (Complet pour Render)
                const msgEnv = `PREFIXE=.
NOM_OWNER=Luis Orvann
NUMERO_OWNER=${sock.user.id.split(':')[0]}
MODE=private
SESSION_ID=${shortId}
STICKER_AUTHOR_NAME=Luis Orvann`;

                // 4. Envoyer
                const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

                await sock.sendMessage(myJid, { text: msgInfo });
                await delay(1000);
                await sock.sendMessage(myJid, { text: msgEnv });

                console.log('📨 MESSAGES (INFO + SHORT ID) ENVOYÉS !');

            } catch (e) {
                console.error('Erreur finale:', e);
            }

            console.log('🛑 ARRÊTEZ CE TERMINAL (Ctrl+C).');
            console.log('👉 Puis lancez : node index.js');
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
