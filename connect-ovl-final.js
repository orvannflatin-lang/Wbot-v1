import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    Browsers,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';

async function start() {
    console.log("🚀 Démarrage WBOT - Mode OVL EXACT");

    const phoneNumber = "22963062969";

    // 1. Clean Auth
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: 'silent' });

    // 2. OVL Configuration (Exact Copy)
    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        // OVL uses this specific string
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
        markOnlineOnConnect: false,
        receivedPendingNotifications: true,
        getMessage: async () => { return undefined; },
        connectTimeoutMs: 150000,
        defaultQueryTimeoutMs: 150000,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true
    });

    // 3. Pairing Code Request
    if (!sock.authState.creds.registered) {
        console.log('\n⏳ Demande du code de pairage (Style OVL)...');
        try {
            await delay(2000);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n🔑 CODE DE CONNEXION OVL :`);
            console.log(`\n    ${code?.match(/.{1,4}/g)?.join('-') || code}\n`);
        } catch (err) {
            console.error("❌ Erreur demande code:", err);
            // If pairing fails, we fall back to QR (printQRInTerminal is true)
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Connexion fermée. Raison: ${reason}`);
        }

        if (connection === 'open') {
            console.log("\n✅ CONNEXION RÉUSSIE (MÉTHODE OVL) !");
            process.exit(0);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

start();
