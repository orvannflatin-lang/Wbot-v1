// Test ULTRA-BASIQUE - Juste la connexion Baileys
import makeWASocket, {
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason,
    delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

console.log('🧪 Test basique Baileys...\n');

// Nettoyer
const testDir = './auth_basic_test';
if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
}

const { state, saveCreds } = await useMultiFileAuthState(testDir);

console.log('📡 Création du socket...\n');

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
    getMessage: async () => ({ conversation: '' })
});

sock.ev.on('creds.update', saveCreds);

let qrShown = false;

sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // QR CODE EN PRIORITÉ ABSOLUE
    if (qr && !qrShown) {
        qrShown = true;
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ ✅ ✅ QR CODE GÉNÉRÉ ! ✅ ✅ ✅');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        qrcode.generate(qr, { small: true });
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📱 Scannez ce QR code avec WhatsApp!\n');
        return;
    }

    if (connection === 'connecting') {
        console.log('🔄 Connexion...');
    } else if (connection === 'open') {
        console.log('\n✅ CONNEXION RÉUSSIE!\n');
        console.log('ID:', sock.user.id);
        setTimeout(() => process.exit(0), 2000);
    } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log('\n❌ Connexion fermée');
        console.log('Code:', statusCode);
        console.log('Message:', lastDisconnect?.error?.message || 'N/A');
        
        if (statusCode === 405) {
            console.log('\n⚠️ ERREUR 405');
            console.log('Même avec la config la plus simple...');
            console.log('C\'est probablement un problème système/antivirus');
        }
        process.exit(1);
    }
});

console.log('⏳ En attente...\n');
console.log('Si aucun QR code n\'apparaît en 10 secondes, c\'est un problème réseau/système\n');




