import { UserConfig } from '../database/schema.js';

/**
 * Gère le like automatique des statuts WhatsApp
 * @param {Object} sock - Socket Baileys
 * @param {Object} message - Message de statut reçu
 * @param {string} ownerJid - JID du propriétaire
 */
export async function handleAutoStatusLike(sock, message, ownerJid) {
    try {
        // Vérifier si c'est un statut
        if (message.key.remoteJid !== 'status@broadcast') {
            return false;
        }

        // Récupérer la configuration utilisateur
        const userConfig = await UserConfig.findOne({ where: { jid: ownerJid } });

        // Vérifier si l'auto-like est activé
        if (!userConfig || !userConfig.autoLikeStatus) {
            return false;
        }

        // Récupérer l'emoji configuré (par défaut ❤️)
        const likeEmoji = userConfig.likeEmoji || '❤️';

        // Envoyer la réaction au statut
        const statusKey = message.key;

        await sock.sendMessage(statusKey.remoteJid, {
            react: {
                text: likeEmoji,
                key: statusKey
            }
        });

        console.log(`✅ Statut auto-liké avec ${likeEmoji}`);
        return true;

    } catch (error) {
        console.error('❌ Erreur handleAutoStatusLike:', error.message);
        return false;
    }
}

/**
 * Configure l'emoji de like pour les statuts
 * @param {string} ownerJid - JID du propriétaire
 * @param {string} emoji - Emoji à utiliser
 */
export async function setLikeEmoji(ownerJid, emoji) {
    try {
        await UserConfig.update(
            { likeEmoji: emoji },
            { where: { jid: ownerJid } }
        );
        return true;
    } catch (error) {
        console.error('Erreur setLikeEmoji:', error);
        return false;
    }
}

/**
 * Active/désactive l'auto-like des statuts
 * @param {string} ownerJid - JID du propriétaire
 * @param {boolean} enabled - Activer ou désactiver
 */
export async function toggleAutoLikeStatus(ownerJid, enabled) {
    try {
        await UserConfig.update(
            { autoLikeStatus: enabled },
            { where: { jid: ownerJid } }
        );
        return true;
    } catch (error) {
        console.error('Erreur toggleAutoLikeStatus:', error);
        return false;
    }
}
