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

console.log('🔍 Test de connexion WhatsApp...\n');

// Nettoyer la session de test
const testAuthDir = './auth_test';
if (fs.existsSync(testAuthDir)) {
    fs.rmSync(testAuthDir, { recursive: true, force: true });
    console.log('✅ Session de test nettoyée\n');
}

const { state, saveCreds } = await useMultiFileAuthState(testAuthDir);

console.log('📡 Configuration de la connexion...');
console.log('   - Browser:', 'Desktop');
console.log('   - Timeout:', '60s');
console.log('   - Retry delay:', '3s\n');

const sock = makeWASocket({
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS("Desktop"),
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    retryRequestDelayMs: 3000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    qrTimeout: 60000,
    getMessage: async () => ({ conversation: '' })
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
    }

    if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log('\n❌ Connexion fermée');
        console.log('   Code:', statusCode);
        console.log('   Message:', lastDisconnect?.error?.message || 'N/A');
        
        if (statusCode === DisconnectReason.loggedOut) {
            console.log('\n🔓 Vous avez été déconnecté. Suppression de la session...');
            if (fs.existsSync(testAuthDir)) {
                fs.rmSync(testAuthDir, { recursive: true, force: true });
            }
            process.exit(0);
        } else if (statusCode === 405) {
            console.log('\n⚠️  ERREUR 405 - Connection Failure');
            console.log('   Causes possibles:');
            console.log('   1. Pare-feu Windows bloque la connexion');
            console.log('   2. Problème de réseau (VPN, proxy)');
            console.log('   3. Votre FAI bloque WhatsApp');
            console.log('\n💡 Solutions à essayer:');
            console.log('   - Désactiver temporairement le pare-feu');
            console.log('   - Désactiver le VPN si actif');
            console.log('   - Utiliser un autre réseau (4G/5G)');
            process.exit(1);
        } else {
            console.log('\n🔄 Reconnexion...');
            await delay(3000);
            process.exit(0); // Relancer le test
        }
    } else if (connection === 'open') {
        console.log('\n✅ CONNEXION RÉUSSIE !');
        console.log('   ID:', sock.user.id);
        console.log('\n🎉 Le bot fonctionne correctement !');
        await delay(2000);
        process.exit(0);
    }
});

sock.ev.on('creds.update', saveCreds);

console.log('⏳ En attente de connexion...\n');
console.log('   (Si un QR code apparaît, scannez-le avec WhatsApp)');
console.log('   (Si erreur 405, c\'est un problème réseau/pare-feu)\n');




