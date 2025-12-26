// Test avec configuration EXACTE d'OVL
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

console.log('🧪 Test avec configuration OVL exacte...\n');

// Nettoyer
if (fs.existsSync('./auth_test_ovl')) {
    fs.rmSync('./auth_test_ovl', { recursive: true, force: true });
}

const { state, saveCreds } = await useMultiFileAuthState('./auth_test_ovl');

// Configuration EXACTEMENT comme OVL
const sock = makeWASocket({
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
        return { conversation: '' };
    }
});

sock.ev.on('creds.update', saveCreds);

sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ QR CODE GÉNÉRÉ !');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        qrcode.generate(qr, { small: true });
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    if (connection === 'connecting') {
        console.log('🔄 Connexion...');
    } else if (connection === 'open') {
        console.log('\n✅ ✅ ✅ CONNEXION RÉUSSIE ! ✅ ✅ ✅\n');
        console.log('👤 ID:', sock.user.id);
        process.exit(0);
    } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log('\n❌ Erreur:', statusCode, lastDisconnect?.error?.message);
        process.exit(1);
    }
});

console.log('⏳ En attente...\n');




