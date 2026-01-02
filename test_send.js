import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore, delay } from '@whiskeysockets/baileys';
import pino from 'pino';

async function testSend() {
    console.log('🚀 Démarrage du Test d\'Envoi Isolé...');
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('✅ Connecté ! Tentative d\'envoi...');
            
            const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            
            try {
                await sock.sendMessage(myJid, { text: '🧪 TEST DIAGNOSTIC : Si tu lis ça, le bot PEUT envoyer des messages !' });
                console.log('✅ Message envoyé avec succès à ' + myJid);
            } catch (e) {
                console.error('❌ ECHEC ENVOI:', e);
            }

            console.log('👋 Fin du test dans 2s...');
            await delay(2000);
            process.exit(0);
        }
    });
}

testSend();
