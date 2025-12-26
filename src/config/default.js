export default {
    // Préfixes par défaut
    defaultPrefix: '.',

    prefixes: {
        saveViewOnce: 'save',
        saveStatus: 'dlstatus',
        downloadVideo: 'dl',
        schedule: 'schedule',
        ghost: 'ghost',
        antidelete: 'antidelete',
        help: 'help',
        setPrefix: 'setprefix',
        status: 'status'
    },

    // Limites
    maxUsers: 20,
    maxFileSizeMB: 100,

    // Ghost mode par défaut
    ghostModeDefault: false,

    // Messages
    messages: {
        welcome: '🤖 *WBOT Activé!*\n\nVotre bot WhatsApp multifonctions est prêt.\nTapez `.help` pour voir les commandes disponibles.',

        helpText: `📚 *WBOT - Commandes Disponibles*

*🔒 Vues Uniques:*
Répondez à une vue unique avec \`.save\` pour l'enregistrer

*📸 Statuts:*
Répondez à un statut avec \`.dlstatus\` pour le sauvegarder

*📥 Téléchargeur Vidéos:*
\`.dl <lien>\` - Télécharger une vidéo (TikTok, Instagram, etc.)

*👻 Mode Fantôme:*
\`.ghost on\` - Activer le mode fantôme
\`.ghost off\` - Désactiver le mode fantôme

*🔒 Anti-Delete:*
\`.antidelete all\` - Activer pour tous les messages
\`.antidelete pm\` - Activer pour messages privés
\`.antidelete gc\` - Activer pour groupes
\`.antidelete status\` - Activer pour statuts
\`.antidelete off\` - Désactiver

*⏰ Planificateur:*
\`.schedule <date> <heure> <message>\` - Programmer un statut

*⚙️ Configuration:*
\`.setprefix <nouveau>\` - Changer le préfixe
\`.status\` - Voir l'état du bot
\`.help\` - Afficher cette aide`,

        ghostEnabled: '👻 Mode Fantôme activé! Vos coches bleues sont maintenant invisibles.',
        ghostDisabled: '✅ Mode Fantôme désactivé.',

        prefixChanged: '✅ Préfixe changé en:',

        viewOnceSaved: '✅ Vue unique sauvegardée!',
        statusSaved: '✅ Statut sauvegardé!',
        videoDownloaded: '✅ Vidéo téléchargée!',

        scheduledSuccess: '⏰ Statut programmé avec succès!',

        errorGeneric: '❌ Une erreur est survenue.',
        errorNotOwner: '⛔ Cette commande est réservée au propriétaire.',
        errorInvalidCommand: '❌ Commande invalide. Tapez `.help` pour l\'aide.'
    },

    // Plateformes supportées pour téléchargement
    supportedPlatforms: [
        'tiktok.com',
        'instagram.com',
        'facebook.com',
        'youtube.com',
        'youtu.be',
        'twitter.com',
        'x.com'
    ]
};
