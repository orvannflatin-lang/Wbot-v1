import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';

console.log('Testing Baileys Import...');

try {
    const logger = pino({ level: 'silent' });
    console.log('✅ Pino loaded');
    const { state, saveCreds } = await useMultiFileAuthState('./auth_test');
    console.log('✅ Auth state loaded');
    console.log('✅ Baileys imported successfully');
} catch (error) {
    console.error('❌ Baileys Import Failed:', error);
}
