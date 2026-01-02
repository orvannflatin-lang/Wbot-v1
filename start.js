import dotenv from 'dotenv';
import fs from 'fs';
import { startApiServer } from './src/api/server.js';
import { decodeSession } from './src/utils/session-handler.js';
import { restoreSessionFromSupabase } from './src/utils/supabase-session.js';

// Load environment variables
dotenv.config();

async function start() {
    console.log('╭──────────────────────╮');
    console.log('│   🤖 WBOT Starter   │');
    console.log('╰──────────────────────╯\n');

    const SESSION_ID = process.env.SESSION_ID;
    const hasLocalSession = fs.existsSync('./auth_info') && fs.readdirSync('./auth_info').length > 0;

    if (SESSION_ID || hasLocalSession) {
        if (hasLocalSession && !SESSION_ID) {
            console.log('📋 Mode: BOT (Session locale détectée)');
        } else {
            console.log('📋 Mode: BOT (Session ID détecté)');
        }

        // Lancer directement index.js sans validation préalable
        // index.js gère lui-même la restauration et les erreurs
        console.log('🚀 Démarrage du bot...\n');
        await import('./index.js');
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
