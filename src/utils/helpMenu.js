import {
    createHeader,
    createFooter,
    createMenuItem,
    createSection,
    toBold,
    EMOJIS
} from '../utils/textStyle.js';

/**
 * 📜 DATA: Liste des 50+ Fonctionnalités
 * Classées par catégories pour générer les différents menus.
 */
const COMMAND_DATA = {
    'automation': {
        title: 'AUTOMATION & PLANIF 🕒',
        cmds: [
            { cmd: 'schedule', desc: 'Programmer Msg', detail: 'Programmer un message (Heure | @tag | Message)' },
            { cmd: 'schstatus', desc: 'Programmer Statut', detail: 'Programmer la publication d\'un statut' },
            { cmd: 'listplan', desc: 'Voir Tâches', detail: 'Voir tous les messages et statuts en attente' },
            { cmd: 'remind', desc: 'Rappel Perso', detail: 'Le bot te rappelle une tâche à une heure précise' },
            { cmd: 'away', desc: 'Mode AFK', detail: 'Réponse auto personnalisée quand tu es occupé' }
        ]
    },
    'moderation': {
        title: 'MODÉRATION 🛡️',
        cmds: [
            { cmd: 'tagall', desc: 'Tag Tout', detail: 'Mentionne tous les membres du groupe' }
        ]
    },
    'productivity': {
        title: 'PRODUCTIVITÉ 🧠',
        cmds: [
            { cmd: 'txt', desc: 'Voice to Text', detail: 'Transcrit une note vocale en texte' },
            { cmd: 'ocr', desc: 'Img to Text', detail: 'Extrait le texte d\'une image' },
            { cmd: 'pdf', desc: 'Img to PDF', detail: 'Transforme une image en PDF' }
        ]
    },
    'multimedia': {
        title: 'MULTIMÉDIA 🎨',
        cmds: [
            { cmd: 'tovideo', desc: 'Sticker->Vid', detail: 'Transforme un sticker animé en vidéo' },
            { cmd: 'lyrics', desc: 'Paroles', detail: 'Affiche les paroles d\'une chanson' },
            { cmd: 'voice', desc: 'Voice Changer', detail: 'Modifie une voix (robot, bebe, ecureuil)' }
        ]
    },
    'tools': {
        title: 'OUTILS 🛠️',
        cmds: [
            { cmd: 'id', desc: 'ID Groupe', detail: 'Obtenir l\'ID du groupe' },
            { cmd: 'tempmail', desc: 'Email Jetable', detail: 'Génère un email temporaire' },
            { cmd: 'qr', desc: 'QR Gen', detail: 'Transforme un texte ou lien en QR Code' },
            { cmd: 'poll', desc: 'Sondage', detail: 'Crée un sondage' }
        ]
    },
    'fun': {
        title: 'FUN & SOCIAL 🎭',
        cmds: [
            { cmd: 'vibe', desc: 'Vibe Check', detail: 'Analyse l\'ambiance du groupe (Humour)' },
            { cmd: 'confess', desc: 'Confession', detail: 'Envoie un aveu anonyme (En privé: .confess ID msg)' },
            { cmd: 'anime', desc: 'Anime Finder', detail: 'Trouve l\'anime à partir d\'une image (Reply)' },
            { cmd: 'voice', desc: 'Voice Changer', detail: 'Modifie une voix (robot, cureuil, echo)' },
            { cmd: 'fakequote', desc: 'Faux Msg', detail: 'Crée une fausse citation élégante' },
            { cmd: 'poll', desc: 'Sondage', detail: 'Crée un sondage interactif' },
            { cmd: 'ttt', desc: 'Tic-Tac-Toe', detail: 'Morpion X O - Joue à 2 ! (.ttt puis 1-9)' },
            { cmd: 'truth', desc: 'Truth or Dare', detail: 'Action ou Vérité aléatoire' },
            { cmd: 'ship', desc: 'Ship', detail: 'Compatibilité amoureuse % (.ship @user1 @user2)' },
            { cmd: 'guess', desc: 'Deviner Nombre', detail: 'Devine le nombre entre 1-100 (.guess <nb>)' },
            { cmd: 'riddle', desc: 'Devinette', detail: 'Devinette aléatoire (.riddle answer pour réponse)' },
            { cmd: 'quiz', desc: 'Quiz Culture G', detail: 'Question culture générale (répondre 1/2/3)' }
        ]
    }
};

/**
 * MENU PRINCIPAL (Custom Design)
 */
export function generateHelpMenu(config) {
    const { prefix, emoji, ownerName } = config;

    return `╭───〔 🤖 𝗪𝗕𝗢𝗧 𝗠𝗘𝗡𝗨 〕───⬣
│
│ ߷ 𝗢𝘄𝗻𝗲𝗿 ➜ ${ownerName}
│ ߷ 𝗣𝗿𝗲𝗳𝗶𝘅 ➜ ${prefix}
│ ߷ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 ➜ 1.0.0
│
│ ━━ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗘𝗦 𝗗𝗘 𝗕𝗔𝗦𝗘 ━━
│
│ 🏓 ${prefix}𝗽𝗶𝗻𝗴 ➜ Tester la vitesse du bot
│ 📋 ${prefix}𝗺𝗲𝗻𝘂 ➜ Afficher ce menu
│ ℹ️ ${prefix}𝗵𝗲𝗹𝗽 ➜ Afficher l'aide complète
│
│ ━━ 𝗦𝗔𝗨𝗩𝗘𝗚𝗔𝗥𝗗𝗘 & 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 ━━
│
│ 💾 ${prefix}𝘀𝗮𝘃𝗲 ➜ Sauvegarder un statut
│ ⬇️ ${prefix}𝗱𝗹 <𝗹𝗶𝗲𝗻> ➜ Télécharger vidéo
│ 🎨 ${prefix}𝘀 ➜ Créer sticker (reply)
│
│ ━━ 𝗔𝗨𝗧𝗢-𝗟𝗜𝗞𝗘 𝗦𝗧𝗔𝗧𝗨𝗧𝗦 ━━
│
│ 💚 ${prefix}𝗮𝘂𝘁𝗼𝗹𝗶𝗸𝗲 𝗼𝗻 ➜ Activer l'auto-like
│ 🔥 ${prefix}𝗮𝘂𝘁𝗼𝗹𝗶𝗸𝗲 🔥 ➜ Activer avec emoji 🔥
│ ⚙️ ${prefix}𝗮𝘂𝘁𝗼𝗹𝗶𝗸𝗲 𝗲𝗺𝗼𝗷𝗶 ❤️ ➜ Changer l'emoji
│ ❌ ${prefix}𝗮𝘂𝘁𝗼𝗹𝗶𝗸𝗲 𝗼𝗳𝗳 ➜ Désactiver l'auto-like
│
│ ━━ 𝗚𝗥𝗢𝗨𝗣𝗘 & 𝗔𝗗𝗠𝗜𝗡 ━━
│
│ 📢 ${prefix}𝘁𝗮𝗴𝗮𝗹𝗹 <𝗺𝘀𝗴> ➜ Taguer tout le monde
│ ⚙️ ${prefix}𝘀𝗲𝘁𝘁𝗮𝗴𝗲𝗺𝗼𝗷𝗶 <𝗲> ➜ Changer emoji Tag
│ 👮 ${prefix}𝗮𝗱𝗺𝗶𝗻 ➜ Gérer les admins (Bientôt)
│
│ ━━ 𝗔𝗡𝗧𝗜-𝗗𝗘𝗟𝗘𝗧𝗘 ━━
│
│ 🗑️ ${prefix}𝗮𝗻𝘁𝗶𝗱𝗲𝗹𝗲𝘁𝗲 𝗮𝗹𝗹 ➜ Activer pour tout message
│ 👤 ${prefix}𝗮𝗻𝘁𝗶𝗱𝗲𝗹𝗲𝘁𝗲 𝗽𝗺 ➜ Activer en privé seulement
│ 👥 ${prefix}𝗮𝗻𝘁𝗶𝗱𝗲𝗹𝗲𝘁𝗲 𝗴𝗰 ➜ Activer en groupe seulement
│ ❌ ${prefix}𝗮𝗻𝘁𝗶𝗱𝗲𝗹𝗲𝘁𝗲 𝗼𝗳𝗳 ➜ Désactiver l'anti-delete
│
│ ━━ 𝗜𝗡𝗧𝗘𝗟𝗟𝗜𝗚𝗘𝗡𝗖𝗘 𝗔𝗥𝗧𝗜𝗙𝗜𝗖𝗜𝗘𝗟𝗟𝗘 🧠 ━━
│
│ 🧠 ${prefix}𝗴𝗲𝗺𝗶𝗻𝗶 <𝗾𝘂𝗲𝘀𝘁𝗶𝗼𝗻> ➜ Discuter avec l'IA
│ 👀 ${prefix}𝘄𝗵𝗮𝘁 ➜ Analyser une image (reply)
│ 📝 ${prefix}𝘀𝘂𝗺𝗺𝗮𝗿𝘆 ➜ Résumer un texte (reply)
│ 🎨 ${prefix}𝗶𝗺𝗴 <𝗽𝗿𝗼𝗺𝗽𝘁> ➜ Générer une image
│
│ ━━ 𝗣𝗢𝗪𝗘𝗥 𝗨𝗦𝗘𝗥 ━━
│
│ ⚙️ ${prefix}𝘀𝗲𝘁𝗽𝗿𝗲𝗳𝗶𝘅 <𝘀𝘆𝗺𝗯𝗼𝗹𝗲> ➜ Changer le préfixe
│ ⚡ ${prefix}𝘀𝗲𝘁𝘀𝗵𝗼𝗿𝘁𝗰𝘂𝘁 👽 𝘃𝘃 ➜ Créer raccourci emoji
│ 🗑️ ${prefix}𝗱𝗲𝗹𝘀𝗵𝗼𝗿𝘁𝗰𝘂𝘁 👽 ➜ Supprimer raccourci
│ 👁️ ${prefix}𝘃𝘃 ➜ Récupérer vue unique (Reply)
│ 📸 ${prefix}𝗽𝗽 ➜ Récupérer Photo de Profil
│
│ -- 𝗩𝗢𝗦 𝗥𝗔𝗖𝗖𝗢𝗨𝗥𝗖𝗜𝗦 --
│
│ 👁️ 👁️ ➜ vv
│ 👀 👀 ➜ vv
│ 💾 💾 ➜ save
│ 🏓 🏓 ➜ ping
│ 📋 📋 ➜ menu
│
│ ⭐ 𝗧𝗜𝗣𝗦 ⭐
│ Faites ${prefix}help <commande>
│ Ex: ${prefix}help setshortcut
│
╰─────
©2026 𝗪𝗕𝗢𝗧 𝗯𝘆 𝗟𝘂𝗶𝘀 𝗢𝗿𝘃𝗮𝗻𝗻`;
}

/**
 * MENU COMPLET (.allmenu)
 * Liste COMPACTE de toutes les commandes (Cmd + Desc courte).
 */
export function generateAllMenu(config = {}) {
    const prefix = config.prefix || '.';
    let menu = createHeader('WBOT ALL-MENU', '📜');

    // Parcourir toutes les catégories
    for (const [key, category] of Object.entries(COMMAND_DATA)) {
        const items = category.cmds.map(c =>
            createMenuItem(`${prefix}${c.cmd}`, c.desc, '🔹')
        );
        menu += createSection(category.title, items);
    }

    menu += createFooter();
    menu += `\n\n> © WBOT Ultra`;
    return menu;
}

/**
 * GUIDE DÉTAILLÉ (.helpall)
 * Liste DÉTAILLÉE (Cmd + Detail).
 */
export function generateHelpAll(config = {}) {
    const prefix = config.prefix || '.';
    let msg = `╭───〔 📚 GUIDE DÉTAILLÉ 〕───⬣\n`;

    for (const [key, category] of Object.entries(COMMAND_DATA)) {
        msg += `\n│ 🌟 *${category.title}*\n`;
        category.cmds.forEach(c => {
            msg += `│ 🔸 *${prefix}${c.cmd}* : ${c.detail}\n`;
        });
        msg += `│\n`;
    }

    msg += `╰──────────────────────────⬣`;
    return msg;
}

// Export pour compatibilité
export function generateCommandHelp(cmd, config) {
    const categories = Object.values(COMMAND_DATA);
    for (const cat of categories) {
        const found = cat.cmds.find(c => c.cmd === cmd);
        if (found) {
            return `ℹ️ *AIDE : ${config.prefix}${cmd}*\n\n${found.detail}\n\nUsage: .${cmd} ...`;
        }
    }
    return `❌ Commande introuvable : ${cmd}`;
}
