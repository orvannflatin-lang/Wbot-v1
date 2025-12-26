import { UserConfig } from '../database/schema.js';

/**
 * Gère le mode fantôme (Ghost Mode)
 * Permet de lire les messages sans envoyer d'accusés de lecture
 */

let ghostModeActive = new Map(); // Map de JID -> boolean

/**
 * Initialise le mode fantôme pour un utilisateur
 * @param {string} userJid - JID de l'utilisateur
 */
export async function initGhostMode(userJid) {
    try {
        const userConfig = await UserConfig.findOne({ where: { jid: userJid } });
        if (userConfig) {
            ghostModeActive.set(userJid, userConfig.ghostMode);
        }
    } catch (error) {
        console.error('Erreur initGhostMode:', error);
    }
}

/**
 * Active/désactive le mode fantôme
 * @param {Object} sock - Socket Baileys
 * @param {string} userJid - JID de l'utilisateur
 * @param {boolean} enable - true pour activer, false pour désactiver
 */
export async function toggleGhostMode(sock, userJid, enable) {
    try {
        // Mettre à jour en DB
        const [userConfig] = await UserConfig.findOrCreate({
            where: { jid: userJid },
            defaults: { jid: userJid, ghostMode: enable }
        });

        userConfig.ghostMode = enable;
        await userConfig.save();

        // Mettre à jour en cache
        ghostModeActive.set(userJid, enable);

        const message = enable
            ? '👻 Mode Fantôme activé!\n\n✅ Vous pouvez lire les messages sans coches bleues\n✅ Vous voyez toujours qui vous lit'
            : '✅ Mode Fantôme désactivé.';

        await sock.sendMessage(userJid, { text: message });

        console.log(`Ghost mode ${enable ? 'activé' : 'désactivé'} pour ${userJid}`);
        return true;
    } catch (error) {
        console.error('Erreur toggleGhostMode:', error);
        return false;
    }
}

/**
 * Vérifie si le mode fantôme est actif pour un utilisateur
 * @param {string} userJid - JID de l'utilisateur
 * @returns {boolean}
 */
export function isGhostModeActive(userJid) {
    return ghostModeActive.get(userJid) || false;
}

/**
 * Intercepte les accusés de lecture (read receipts)
 * À appeler avant d'envoyer les read receipts
 * @param {string} userJid - JID de l'utilisateur qui lit
 * @returns {boolean} - true si on doit bloquer l'accusé de lecture
 */
export function shouldBlockReadReceipt(userJid) {
    return isGhostModeActive(userJid);
}

/**
 * Gère l'événement de présence (en ligne/hors ligne)
 * @param {Object} sock - Socket Baileys
 * @param {string} userJid - JID de l'utilisateur
 */
export async function handlePresence(sock, userJid) {
    try {
        if (isGhostModeActive(userJid)) {
            // En mode fantôme, toujours apparaître comme "unavailable"
            await sock.sendPresenceUpdate('unavailable', userJid);
        }
    } catch (error) {
        console.error('Erreur handlePresence:', error);
    }
}

export default {
    initGhostMode,
    toggleGhostMode,
    isGhostModeActive,
    shouldBlockReadReceipt,
    handlePresence
};
