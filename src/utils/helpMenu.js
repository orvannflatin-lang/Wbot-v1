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
        createMenuItem(`${prefix}save`, 'Sauvegarder un statut (répondre)', EMOJIS.save),
        createMenuItem(`${prefix}dl <lien>`, 'Télécharger une vidéo', '⬇️')
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

    // Section Ghost Mode
    const ghostCommands = [
        createMenuItem(`${prefix}ghost on`, 'Activer le mode fantôme', EMOJIS.ghost),
        createMenuItem(`${prefix}ghost off`, 'Désactiver le mode fantôme', '✅')
    ];
    menu += createSection('MODE FANTÔME', ghostCommands);

    // Section Power User (Nouveau)
    const powerCommands = [
        createMenuItem(`${prefix}setprefix <symbole>`, 'Changer le préfixe', '⚙️'),
        createMenuItem(`${prefix}setshortcut 👽 vv`, 'Créer raccourci emoji', '⚡'),
        createMenuItem(`${prefix}delshortcut 👽`, 'Supprimer raccourci', '🗑️'),
        createMenuItem(`${prefix}vv`, 'Récupérer vue unique (Reply)', '👁️')
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
        'ghost': {
            title: 'MODE FANTÔME',
            emoji: EMOJIS.ghost,
            description: 'Masque vos coches bleues et apparaître hors ligne',
            usage: [
                `${prefix}ghost on → Active le mode fantôme`,
                `${prefix}ghost off → Désactive le mode fantôme`
            ],
            features: [
                'Coches bleues invisibles',
                'Apparaître hors ligne',
                'Lire sans être vu'
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
