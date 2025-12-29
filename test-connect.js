
import makeWASocket, { useMultiFileAuthState, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';

async function connect() {
    console.log("🛠️ TEST DE CONNEXION MINIMAL...");
    // On utilise un nouveau dossier pour être sûr
    const { state, saveCreds } = await useMultiFileAuthState('test_auth_minimal');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        // Retour aux valeurs par défaut strictes de Baileys
        browser: Browsers.macOS("Desktop"),
        connectTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) console.log("📷 QR Reçu !");

        if (connection === 'close') {
            console.log('❌ FERMETURE :', lastDisconnect?.error);
        }

        if (connection === 'open') {
            console.log('✅ SUCCÈS ! CONNEXION ÉTABLIE !');
            console.log('Vous pouvez arrêter le script (Ctrl+C).');
            process.exit(0);
        }
    });
}
connect();
