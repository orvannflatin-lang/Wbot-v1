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

    // TOUJOURS lancer le serveur web (pour l'interface)
    console.log('🌐 Serveur Web en écoute...\n');
    const { default: express } = await import('express');
    const app = express();
    startApiServer(app);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🌐 API Server running on port ${PORT}`);
        console.log(`📡 Frontend: http://localhost:${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/api/health\n`);
    });

    if (SESSION_ID || hasLocalSession) {
        if (hasLocalSession && !SESSION_ID) {
            console.log('📋 Mode: BOT (Session locale détectée)');
        } else {
            console.log('📋 Mode: BOT (Session ID détecté)');
        }

        // Lancer le bot
        console.log('🚀 Démarrage du bot...\n');
        await import('./index.js');
    } else {
        // Mode PAIRING uniquement
        console.log('📋 Mode: PAIRING (Première configuration)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 Ouvrez la page web WBOT pour connecter WhatsApp');
        console.log('🔗 Local: http://localhost:3000');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
