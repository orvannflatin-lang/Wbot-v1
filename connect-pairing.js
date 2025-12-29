import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(resolve => rl.question(q, resolve));

async function start() {
    console.log("🚀 Démarrage WBOT - Mode CODE DE PAIRAGE");

    const phoneNumber = "22963062969";
    // const phoneNumber = await question("\n📱 Entrez votre numéro (ex: 33612345678) : ");
    // rl.close();

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("Desktop"),
        printQRInTerminal: false, // On veut le code, pas le QR
        mobile: false,
        syncFullHistory: false
    });

    if (!sock.authState.creds.registered) {
        console.log('\n⏳ Demande du code de pairage...');
        try {
            await delay(2000);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n🔑 VOTRE CODE DE CONNEXION :`);
            console.log(`\n    ${code?.match(/.{1,4}/g)?.join('-') || code}\n`);
            console.log("👉 Entrez ce code sur WhatsApp > Appareils connectés > Connecter un appareil > Connecter avec le numéro de téléphone.");
        } catch (err) {
            console.error("❌ Erreur demande code:", err);
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Connexion fermée. Raison: ${reason}`);
            if (reason === 405) {
                console.log("⚠️ Toujours Erreur 405...");
            }
        }

        if (connection === 'open') {
            console.log("\n✅ CONNEXION RÉUSSIE !");
            process.exit(0);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

start();
