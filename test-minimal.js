// Test minimal avec configuration ultra-simplifiée
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

console.log('🧪 Test de connexion minimal...\n');

// Nettoyer la session de test
if (fs.existsSync('./auth_test')) {
    fs.rmSync('./auth_test', { recursive: true, force: true });
}

const { state, saveCreds } = await useMultiFileAuthState('./auth_test');

// Configuration ABSOLUMENT MINIMALE
const sock = makeWASocket({
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS("Desktop"),
    printQRInTerminal: false,
    syncFullHistory: false
});

let qrShown = false;

sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !qrShown) {
        qrShown = true;
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ QR CODE GÉNÉRÉ !');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        qrcode.generate(qr, { small: true });
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📱 Scannez ce QR code avec WhatsApp!\n');
    }

    if (connection === 'connecting') {
        console.log('🔄 Connexion...');
    } else if (connection === 'open') {
        console.log('\n✅ ✅ ✅ CONNEXION RÉUSSIE ! ✅ ✅ ✅\n');
        process.exit(0);
    } else if (connection === 'close') {
        const error = lastDisconnect?.error;
        const statusCode = error?.output?.statusCode || error?.statusCode;
        console.log('\n❌ Erreur:', statusCode);
        console.log('Full Error:', JSON.stringify(error, null, 2));

        if (statusCode === 405) {
            console.log('\n⚠️  ERREUR 405 détectée');
            console.log('\n💡 Solutions à essayer:');
            console.log('   1. Ouvrez PowerShell en Administrateur');
            console.log('   2. Exécutez: .\fix-connection.ps1');
            console.log('   3. Vérifiez votre antivirus');
            console.log('   4. Essayez avec un VPN');
        }
        process.exit(1);
    }
});

sock.ev.on('creds.update', saveCreds);

console.log('⏳ En attente de connexion...\n');
console.log('   (Si un QR code apparaît, scannez-le)');
console.log('   (Si erreur 405, voir solutions ci-dessus)\n');




