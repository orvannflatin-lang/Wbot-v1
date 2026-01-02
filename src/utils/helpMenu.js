import {
    createHeader,
    createFooter,
    createMenuItem,
    createSection,
    toBold,
    EMOJIS
} from '../utils/textStyle.js';

/**
 * Génère le menu .help complet et stylisé
 */
export function generateHelpMenu(config = {}) {
    const prefix = config.prefix || '.';
    const ownerName = config.ownerName || 'Admin';

    let menu = createHeader('WBOT MENU', '🤖');

    // Informations du bot
    menu += `\n│ ${EMOJIS.bullet} ${toBold('Owner')} ${EMOJIS.arrow} ${ownerName}`;
    menu += `\n│ ${EMOJIS.bullet} ${toBold('Prefix')} ${EMOJIS.arrow} ${prefix}`;
    menu += `\n│ ${EMOJIS.bullet} ${toBold('Version')} ${EMOJIS.arrow} 1.0.0`;

    // Section Commandes de Base
    const baseCommands = [
        createMenuItem(`${prefix}ping`, 'Tester la vitesse du bot', '🏓'),
        createMenuItem(`${prefix}menu`, 'Afficher ce menu', EMOJIS.menu),
        createMenuItem(`${prefix}help`, 'Afficher l\'aide complète', 'ℹ️')
    ];
    menu += createSection('COMMANDES DE BASE', baseCommands);

    // Section Sauvegarde & Téléchargement
    const saveCommands = [
        createMenuItem(`${prefix}save`, 'Sauvegarder un statut', EMOJIS.save),
        createMenuItem(`${prefix}dl <lien>`, 'Télécharger vidéo (TikTok/YT/Insta/FB)', '⬇️'),
        createMenuItem(`${prefix}mp3 <lien>`, 'Extraire audio MP3', '🎵'),
        createMenuItem(`${prefix}s`, 'Créer sticker (reply)', '🎨')
    ];
    menu += createSection('SAUVEGARDE & DOWNLOAD', saveCommands);

    // Section Auto-Like
    const likeCommands = [
        createMenuItem(`${prefix}autolike on`, 'Activer l\'auto-like', EMOJIS.heart),
        createMenuItem(`${prefix}autolike 🔥`, 'Activer avec emoji 🔥', '🔥'),
        createMenuItem(`${prefix}autolike emoji ❤️`, 'Changer l\'emoji', '⚙️'),
        createMenuItem(`${prefix}autolike off`, 'Désactiver l\'auto-like', '❌')
    ];
    menu += createSection('AUTO-LIKE STATUTS', likeCommands);

    // Section Groupe & Admin
    const groupCommands = [
        createMenuItem(`${prefix}tagall <msg>`, 'Taguer tout le monde', '📢'),
        createMenuItem(`${prefix}settagemoji <e>`, 'Changer emoji Tag', '⚙️'),
        createMenuItem(`${prefix}admin`, 'Gérer les admins (Bientôt)', '👮')
    ];
    menu += createSection('GROUPE & ADMIN', groupCommands);


    // Section Anti-Delete
    const antiDeleteCommands = [
        createMenuItem(`${prefix}antidelete all`, 'Activer pour tout message', '🗑️'),
        createMenuItem(`${prefix}antidelete pm`, 'Activer en privé seulement', '👤'),
        createMenuItem(`${prefix}antidelete gc`, 'Activer en groupe seulement', '👥'),
        createMenuItem(`${prefix}antidelete off`, 'Désactiver l\'anti-delete', '❌')
    ];
    menu += createSection('ANTI-DELETE', antiDeleteCommands);

    // Section Intelligence Artificielle (Nouveau)
    const aiCommands = [
        createMenuItem(`${prefix}gemini <question>`, 'Discuter avec l\'IA', '🧠'),
        createMenuItem(`${prefix}what`, 'Analyser une image (reply)', '👀'),
        createMenuItem(`${prefix}summary`, 'Résumer un texte (reply)', '📝'),
        createMenuItem(`${prefix}img <prompt>`, 'Générer une image', '🎨')
    ];
    menu += createSection('INTELLIGENCE ARTIFICIELLE 🧠', aiCommands);

    // Section Power User (Nouveau)
    const powerCommands = [
        createMenuItem(`${prefix}setprefix <symbole>`, 'Changer le préfixe', '⚙️'),
        createMenuItem(`${prefix}setshortcut 👽 vv`, 'Créer raccourci emoji', '⚡'),
        createMenuItem(`${prefix}delshortcut 👽`, 'Supprimer raccourci', '🗑️'),
        createMenuItem(`${prefix}vv`, 'Récupérer vue unique (Reply)', '👁️'),
        createMenuItem(`${prefix}pp`, 'Récupérer Photo de Profil', '📸')
    ];
    menu += createSection('POWER USER', powerCommands);

    // Section Raccourcis Personnalisés
    if (config.customShortcuts && Object.keys(config.customShortcuts).length > 0) {
        let shortcutItems = [];
        for (const [trigger, cmd] of Object.entries(config.customShortcuts)) {
            // Afficher joliment
            const emoji = /^\p{Emoji}/u.test(trigger) ? trigger : '⌨️';
            const displayTrigger = trigger === emoji ? trigger : toBold(trigger);
            shortcutItems.push(`│ ${emoji} ${displayTrigger} ${EMOJIS.arrow} ${cmd}`);
        }
        menu += `│\n│ ${toBold('-- VOS RACCOURCIS --')}\n│\n`;
        menu += shortcutItems.join('\n') + '\n';
    }

    // Pied de page
    menu += `\n│\n`;
    menu += `│ ${EMOJIS.star} ${toBold('TIPS')} ${EMOJIS.star}`;
    menu += `\n│ Faites ${prefix}help <commande>`;
    menu += `\n│ Ex: ${prefix}help setshortcut`;
    menu += `\n│\n`;
    menu += createFooter();
    menu += `\n\n${toBold('> ©2025 WBOT by Luis Orvann')}`;

    return menu;
}

/**
 * Génère l'aide détaillée pour une commande spécifique
 */
export function generateCommandHelp(command, config = {}) {
    const prefix = config.prefix || '.';

    const helpTexts = {
        'dl': {
            title: 'TÉLÉCHARGEMENT UNIVERSEL',
            emoji: '⬇️',
            description: 'Téléchargez des vidéos depuis TikTok, Instagram, Facebook, YouTube, etc.',
            usage: [
                `${prefix}dl <lien_video>`
            ],
            note: 'Le fichier sera envoyé directement dans la discussion'
        },
        'mp3': {
            title: 'EXTRACTION MP3',
            emoji: '🎵',
            description: 'Convertir une vidéo en fichier audio MP3 haute qualité',
            usage: [
                `${prefix}mp3 <lien_video>`
            ],
            note: 'Le fichier sera envoyé directement dans la discussion'
        },
        's': {
            title: 'CRÉATEUR DE STICKER',
            emoji: '🎨',
            description: 'Transforme une image ou une vidéo en sticker',
            usage: [
                `Répondez à une image/vidéo avec ${prefix}s`,
                `Répondez à une image/vidéo avec ${prefix}sticker`
            ],
            note: 'Le sticker sera envoyé directement dans la discussion'
        },
        'gemini': {
            title: 'CHAT IA (GEMINI PRO)',
            emoji: '🧠',
            description: 'Posez n\'importe quelle question à l\'IA la plus avancée de Google.',
            usage: [
                `${prefix}gemini Raconte une blague`,
                `${prefix}gpt Qui est Elon Musk ?`
            ]
        },
        'what': {
            title: 'ANALYSE D\'IMAGE (VISION)',
            emoji: '👀',
            description: 'L\'IA regarde votre image et la décrit ou répond à une question dessus.',
            usage: [
                `Répondez à une image avec ${prefix}what`,
                `Répondez à une image avec ${prefix}vision Que vois-tu ?`
            ]
        },
        'summary': {
            title: 'RÉSUMÉ INTELLIGENT',
            emoji: '📝',
            description: 'Résume instantanément un long texte ou message.',
            usage: [
                `Répondez à un pavé de texte avec ${prefix}summary`
            ]
        },
        'img': {
            title: 'GÉNÉRATEUR D\'IMAGES',
            emoji: '🎨',
            description: 'Transforme votre texte en image artistique.',
            usage: [
                `${prefix}img un chat cyberpunk dans l'espace`,
                `${prefix}imagine voiture de sport rouge 4k`
            ]
        },
        'setshortcut': {
            title: 'CRÉER RACCOURCI',
            emoji: '⚡',
            description: 'Créez vos propres raccourcis magiques',
            usage: [
                `${prefix}setshortcut <trigger> <commande>`,
                `${prefix}setshortcut 👽 vv`,
                `${prefix}setshortcut s save`
            ],
            note: 'Vous pouvez utiliser un mot ou un emoji comme déclencheur'
        },
        'delshortcut': {
            title: 'SUPPRIMER RACCOURCI',
            emoji: '🗑️',
            description: 'Supprime un raccourci existant',
            usage: [
                `${prefix}delshortcut 👽`
            ]
        },
        'autolike': {
            title: 'AUTO-LIKE STATUTS',
            emoji: EMOJIS.heart,
            description: 'Like automatiquement tous les statuts WhatsApp',
            usage: [
                `${prefix}autolike on → Active avec emoji par défaut`,
                `${prefix}autolike 🔥 → Active avec emoji personnalisé`,
                `${prefix}autolike emoji ❤️ → Change l'emoji`,
                `${prefix}autolike off → Désactive`
            ],
            examples: [
                `${prefix}autolike 💚`,
                `${prefix}autolike emoji 🔥`
            ]
        },
        'antidelete': {
            title: 'ANTI-DELETE',
            emoji: EMOJIS.delete,
            description: 'Sauvegarde les messages avant suppression',
            usage: [
                `${prefix}antidelete all → Tous les messages`,
                `${prefix}antidelete pm → Messages privés uniquement`,
                `${prefix}antidelete gc → Groupes uniquement`,
                `${prefix}antidelete status → Statuts uniquement`,
                `${prefix}antidelete off → Désactiver`
            ],
            note: 'Les messages supprimés vous seront automatiquement renvoyés'
        },
        'save': {
            title: 'SAUVEGARDER STATUT',
            emoji: EMOJIS.save,
            description: 'Sauvegarde un statut dans vos messages personnels',
            usage: [
                `Répondre à un statut avec ${prefix}save`
            ],
            note: 'Le statut sera envoyé dans votre chat personnel'
        }
    };

    const helpData = helpTexts[command];
    if (!helpData) {
        return `${EMOJIS.error} Commande non trouvée. Utilisez ${prefix}help pour voir toutes les commandes.`;
    }

    let help = createHeader(helpData.title, helpData.emoji);
    help += `\n│\n│ ${helpData.description}\n│\n`;

    if (helpData.usage) {
        help += `│ ${toBold('UTILISATION')} :\n│\n`;
        helpData.usage.forEach(usage => {
            help += `│ ${EMOJIS.arrow} ${usage}\n`;
        });
        help += `│\n`;
    }

    if (helpData.features) {
        help += `│ ${toBold('FONCTIONNALITÉS')} :\n│\n`;
        helpData.features.forEach(feature => {
            help += `│ ${EMOJIS.bullet} ${feature}\n`;
        });
        help += `│\n`;
    }

    if (helpData.examples) {
        help += `│ ${toBold('EXEMPLES')} :\n│\n`;
        helpData.examples.forEach(example => {
            help += `│ ${EMOJIS.star} ${example}\n`;
        });
        help += `│\n`;
    }

    if (helpData.note) {
        help += `│ ${EMOJIS.info} ${helpData.note}\n│\n`;
    }

    help += createFooter();

    return help;
}
