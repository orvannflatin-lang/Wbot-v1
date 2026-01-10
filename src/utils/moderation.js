import { Warns, GroupSettings } from '../database/schema.js';
import { errorMessage } from './textStyle.js';

// Regex simple pour liens WhatsApp
const LINK_REGEX = /chat\.whatsapp\.com\/[a-zA-Z0-9]{20,}/;

/**
 * Vérifie la présence de liens interdits
 */
export async function checkAntiLink(sock, m, isGroup, isAdmin, groupJid) {
    if (!isGroup || isAdmin) return false; // Ignorer admins et privés

    const body = m.message?.conversation || m.message?.extendedTextMessage?.text || '';

    // 1. Vérifier si activé
    const [settings] = await GroupSettings.findOrCreate({ where: { jid: groupJid } });
    if (!settings.antilink) return false;

    // 2. Vérifier le contenu
    if (LINK_REGEX.test(body)) {
        console.log(`🛡️ [ANTILIEN] Lien détecté de ${m.key.participant}`);

        // Supprimer message
        await sock.sendMessage(groupJid, { delete: m.key });

        // Avertir
        await sock.sendMessage(groupJid, {
            text: `@${m.key.participant.split('@')[0]} 🚫 *Pas de liens de groupe ici !*`,
            mentions: [m.key.participant]
        });

        // Optionnel : Kick direct ou Warn
        return true; // Stop propagation
    }
    return false;
}

/**
 * Ajoute un avertissement
 */
export async function addWarn(sock, userJid, groupJid) {
    const [warn, created] = await Warns.findOrCreate({
        where: { userJid, groupJid },
        defaults: { count: 0 }
    });

    warn.count += 1;
    await warn.save();

    const LIMIT = 3;
    if (warn.count >= LIMIT) {
        // SANCTION : KICK
        await sock.sendMessage(groupJid, {
            text: `⚠️ *Limite d'avertissements atteinte (${LIMIT}/${LIMIT})*\n👋 Aurevoir @${userJid.split('@')[0]}`,
            mentions: [userJid]
        });

        try {
            await sock.groupParticipantsUpdate(groupJid, [userJid], 'remove');
            // Reset warns après kick
            await warn.destroy();
        } catch (e) {
            await sock.sendMessage(groupJid, { text: `❌ Impossible d'expulser (Je ne suis pas admin ?)` });
        }
        return { count: LIMIT, kicked: true };
    }

    return { count: warn.count, kicked: false };
}

/**
 * Verrouiller/Déverrouiller Groupe
 */
export async function toggleGroupLock(sock, groupJid, lock) {
    // 'announcement' = fermé (seuls admins), 'not_announcement' = ouvert
    const setting = lock ? 'announcement' : 'not_announcement';
    await sock.groupSettingUpdate(groupJid, setting);

    // MàJ DB locale
    const [config] = await GroupSettings.findOrCreate({ where: { jid: groupJid } });
    config.locked = lock;
    await config.save();
}
