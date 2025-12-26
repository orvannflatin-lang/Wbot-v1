import dotenv from 'dotenv';
import fs from 'fs';
import { startApiServer } from './src/api/server.js';
import { decodeSession } from './src/utils/session-handler.js';

// Load environment variables
dotenv.config();

async function start() {
    console.log('╭──────────────────────╮');
    console.log('│   🤖 WBOT Starter   │');
    console.log('╰──────────────────────╯\n');

    const SESSION_ID = process.env.SESSION_ID;

    if (SESSION_ID && SESSION_ID.startsWith('WBOT_')) {
        // MODE: Direct Bot (Production)
        console.log('📋 Mode: BOT (Session détectée)');
        console.log('🔄 Décodage de la session...\n');

        try {
            // Decode SESSION_ID to ./auth_info
            decodeSession(SESSION_ID, './auth_info');
            console.log('✅ Session restaurée\n');

            // Import and start the bot
            const { default: startWBOT } = await import('./index.js');
            await startWBOT();
        } catch (error) {
            console.error('❌ Erreur de décodage de session:', error.message);
            console.error('💡 Vérifiez que votre SESSION_ID est valide\n');
            process.exit(1);
        }
    } else {
        // MODE: API Server (First-time setup)
        console.log('📋 Mode: API SERVER (Première configuration)');
        console.log('🌐 Démarrage du serveur API pour génération de session...\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 Ouvrez la page web WBOT pour connecter WhatsApp');
        console.log('🔗 Local: http://localhost:3000');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        startApiServer();
    }
}

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('❌ Erreur non capturée:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Promesse rejetée:', reason);
});

// Start the application
start().catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
});
