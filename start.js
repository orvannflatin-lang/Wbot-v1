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

    if (SESSION_ID) {
        console.log('📋 Mode: BOT (Session détectée)');

        try {
            if (SESSION_ID.startsWith('WBOT~')) {
                // CAS 1: Session Courte (Supabase)
                console.log('☁️ Récupération depuis Supabase...');
                await restoreSessionFromSupabase(SESSION_ID, './auth_info');
            } else if (SESSION_ID.startsWith('WBOT_')) {
                // CAS 2: Session Longue (Base64/GZIP)
                console.log('🔄 Décodage session locale...');
                decodeSession(SESSION_ID, './auth_info');
            }

            console.log('✅ Session restaurée\n');

            // Import and start the bot
            const { default: startWBOT } = await import('./index.js');
            await startWBOT();
        } catch (error) {
            console.error('❌ Erreur de restauration session:', error.message);
            console.error('💡 Vérifiez votre SESSION_ID\n');
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
