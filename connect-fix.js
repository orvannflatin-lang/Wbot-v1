import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';

async function start() {
    console.log("🚀 Démarrage WBOT - Tentative de connexion...");

    // 1. Nettoyage préventif
    if (fs.existsSync('./auth_info')) {
        fs.rmSync('./auth_info', { recursive: true, force: true });
        console.log("🧹 Session précédente nettoyée");
    }

    // 2. Configuration Auth
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    // 3. Création Socket
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }), // ou 'debug' si ça bug encore
        // Utilisation d'un User-Agent différent pour éviter le blocage 405
        browser: Browsers.macOS("Desktop"),
        printQRInTerminal: true, // Baileys gère l'affichage QR
        mobile: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000
    });

    // 4. Gestion des événements
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n📷 QR Code reçu ! Scannez-le maintenant :");
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Connexion fermée. Raison: ${reason} - ${lastDisconnect?.error?.message}`);

            if (reason === 405) {
                console.log("⚠️ ERREUR 405 DÉTECTÉE !");
                console.log("👉 WhatsApp bloque l'IP ou le User-Agent.");
            } else if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnexion...");
                start();
            } else {
                console.log("❌ Déconnecté définitivement.");
                process.exit(1);
            }
        }

        if (connection === 'open') {
            console.log("\n✅ CONNEXION RÉUSSIE !");
            console.log("ID: " + sock.user.id);
            process.exit(0);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

start();
