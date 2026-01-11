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
    // 🔇 SILENCIEUX SUPRÊME : Filtrage bas niveau
    const API_LOG_FILTER = [
        'Closing session', 'SessionEntry', 'chains:', 'registrationId', 'currentRatchet',
        'AutoLike', 'STATUS DETECTÉ', 'Statut ignoré', 'preKey', 'chainKey', 'Buffer',
        'closing session', 'Bad MAC', 'MessageCounterError',
        'Connexion Base de Données', 'printQRInTerminal', 'deprecated', 'DeprecationWarning',
        'WBOT CONNECTÉ', 'User:', 'Base de Données synchronisée', 'MESSAGES DE BIENVENUE'
    ];

    const shouldIgnore = (args) => {
        const msg = args.map(String).join(' ');
        return API_LOG_FILTER.some(f => msg.includes(f));
    };

    const originalLog = console.log;
    const originalErr = console.error;

    console.log = function (...args) {
        if (!shouldIgnore(args)) originalLog.apply(console, args);
    };
    console.error = function (...args) {
        if (!shouldIgnore(args)) originalErr.apply(console, args);
    };

    const SESSION_ID = process.env.SESSION_ID;
    const hasLocalSession = fs.existsSync('./auth_info') && fs.readdirSync('./auth_info').length > 0;

    // TOUJOURS lancer le serveur web (pour l'interface)
    console.log('🌐 Serveur Web en écoute...\n');
    const { default: express } = await import('express');
    const app = express();

    // Serve Static Files (Frontend)
    app.use(express.static('web'));
    app.use(express.json()); // Pour les APIs

    startApiServer(app);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🌐 API Server running on port ${PORT}`);
        console.log(`📡 Frontend: http://localhost:${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/api/health\n`);
    });

    // 🚀 LOGIQUE DE DÉMARRAGE CRITIQUE SUR RENDER
    try {
        if (!hasLocalSession && SESSION_ID) {
            console.log('☁️ ENV détecté : Restauration depuis Supabase via SESSION_ID...');

            // 1. Tenter de récupérer depuis Supabase
            const restored = await restoreSessionFromSupabase(SESSION_ID);

            if (restored) {
                console.log('✅ Session restaurée depuis la DB !');
            } else {
                console.warn('⚠️ Session introuvable ou erreur DB. Le bot va démarrer en mode QR Scan.');
            }
        }
        else if (hasLocalSession) {
            console.log('📂 Session locale détectée (auth_info).');
        }
        else {
            console.log('🆕 Pas de session. Mode QR Scan attente...');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📱 Ouvrez la page web WBOT pour connecter WhatsApp');
            console.log('🔗 Local: http://localhost:3000');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }

    }
}

// Handle errors
// Handle errors - Filtre Anti-Spam (Bad MAC, etc.)
process.on('uncaughtException', (error) => {
    const msg = error?.message || String(error);
    if (msg.includes('Bad MAC') || msg.includes('Session error') || msg.includes('Connection Closed') || msg.includes('socket hung up')) {
        // Silence radio sur les erreurs de session connues (Session corrompue)
        return;
    }
    console.error('❌ Erreur non capturée:', error);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || String(reason);
    if (msg.includes('Bad MAC') || msg.includes('Session error') || msg.includes('Connection Closed') || msg.includes('socket hung up')) {
        // Silence radio
        return;
    }
    console.error('❌ Promesse rejetée:', reason);
});

// Start the application
start().catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
});
