import config from '../config/default.js';
import { UserConfig } from '../database/schema.js';
import { handleViewOnce } from '../features/viewonce-saver.js';
import { handleStatusSave } from '../features/status-saver.js';
import { toggleGhostMode, isGhostModeActive } from '../features/ghost-mode.js';
import { scheduleStatus, parseScheduleCommand } from '../features/status-scheduler.js';
import { downloadVideo } from '../features/video-downloader.js';
import { toggleAntiDelete, isAntiDeleteActive } from '../features/antidelete.js';
import { toggleAutoLikeStatus, setLikeEmoji } from '../features/auto-status-like.js';

/**
 * Gestionnaire principal des messages
 * @param {Object} sock - Socket Baileys
 * @param {Object} message - Message reçu
 * @param {string} ownerJid - JID du propriétaire
 */
export async function handleMessage(sock, message, ownerJid) {
    try {
        if (!message.message) return;

        const senderJid = message.key.remoteJid;
        const fromMe = message.key.fromMe;

        // Extraire le texte du message
        const text =
            message.message.conversation ||
            message.message.extendedTextMessage?.text ||
            message.message.imageMessage?.caption ||
            message.message.videoMessage?.caption ||
            '';

        // Obtenir la config utilisateur
        const [userConfig] = await UserConfig.findOrCreate({
            where: { jid: ownerJid },
            defaults: {
                jid: ownerJid,
                prefix: config.defaultPrefix,
                isOwner: true
            }
        });

        const prefix = userConfig.prefix || config.defaultPrefix;

        // Vérifier si c'est une réponse à une vue unique
        const isViewOnceReply = await handleViewOnce(sock, message, ownerJid);
        if (isViewOnceReply) return;

        // Vérifier si c'est une réponse à un statut
        const isStatusReply = await handleStatusSave(sock, message, ownerJid);
        if (isStatusReply) return;

        // Si le message ne commence pas par le préfixe, ignorer
        if (!text.startsWith(prefix)) return;

        // Parser la commande
        const commandText = text.slice(prefix.length).trim();
        const [command, ...args] = commandText.split(' ');
        const lowerCommand = command.toLowerCase();

        // Vérifier si c'est une commande Owner only
        const isOwner = userConfig.isOwner || senderJid === ownerJid;

        // Router vers la bonne commande
        switch (lowerCommand) {
            case config.prefixes.help:
                await handleHelp(sock, senderJid);
                break;

            case config.prefixes.ghost:
                if (!isOwner) {
                    await sock.sendMessage(senderJid, { text: config.messages.errorNotOwner });
                    return;
                }
                await handleGhost(sock, senderJid, args[0]);
                break;

            case config.prefixes.antidelete:
                if (!isOwner) {
                    await sock.sendMessage(senderJid, { text: config.messages.errorNotOwner });
                    return;
                }
                await handleAntiDelete(sock, senderJid, args[0]);
                break;

            case config.prefixes.downloadVideo:
                if (!isOwner) {
                    await sock.sendMessage(senderJid, { text: config.messages.errorNotOwner });
                    return;
                }
                await handleDownload(sock, senderJid, ownerJid, args[0]);
                break;

            case config.prefixes.schedule:
                if (!isOwner) {
                    await sock.sendMessage(senderJid, { text: config.messages.errorNotOwner });
                    return;
                }
                await handleSchedule(sock, senderJid, commandText);
                break;

            case config.prefixes.status:
                await handleStatus(sock, senderJid, userConfig);
                break;

            case config.prefixes.setPrefix:
                if (!isOwner) {
                    await sock.sendMessage(senderJid, { text: config.messages.errorNotOwner });
                    return;
                }
                await handleSetPrefix(sock, senderJid, args[0]);
                break;

            case 'ping':
                await sock.sendMessage(senderJid, { text: '🏓 Pong!' });
                break;

            case 'autolike':
                if (!isOwner) {
                    await sock.sendMessage(senderJid, { text: config.messages.errorNotOwner });
                    return;
                }
                await handleAutoLike(sock, senderJid, ownerJid, args[0]);
                break;

            case 'setemoji':
                if (!isOwner) {
                    await sock.sendMessage(senderJid, { text: config.messages.errorNotOwner });
                    return;
                }
                await handleSetEmoji(sock, senderJid, ownerJid, args[0]);
                break;

            default:
                await sock.sendMessage(senderJid, { text: config.messages.errorInvalidCommand });
        }

    } catch (error) {
        console.error('Erreur handleMessage:', error);
    }
}

/**
 * Commande Help
 */
async function handleHelp(sock, jid) {
    await sock.sendMessage(jid, { text: config.messages.helpText });
}

/**
 * Commande Ghost Mode
 */
async function handleGhost(sock, jid, action) {
    if (!action) {
        const isActive = isGhostModeActive(jid);
        await sock.sendMessage(jid, {
            text: `👻 Mode Fantôme: ${isActive ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌'}\n\n` +
                `Utilisez \`.ghost on\` ou \`.ghost off\` pour changer.`
        });
        return;
    }

    const enable = action.toLowerCase() === 'on';
    await toggleGhostMode(sock, jid, enable);
}

/**
 * Commande AntiDelete
 */
async function handleAntiDelete(sock, jid, action) {
    if (!action) {
        const isActive = await isAntiDeleteActive(jid);
        await sock.sendMessage(jid, {
            text: `🔒 Anti-Delete: ${isActive ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌'}\n\n` +
                `Utilisez \`.antidelete all/pm/gc/status/off\` pour configurer.`
        });
        return;
    }

    const actionLower = action.toLowerCase();

    if (actionLower === 'off') {
        await toggleAntiDelete(sock, jid, false);
    } else if (actionLower === 'all') {
        await toggleAntiDelete(sock, jid, { all: true });
    } else if (actionLower === 'pm') {
        await toggleAntiDelete(sock, jid, { pm: true });
    } else if (actionLower === 'gc') {
        await toggleAntiDelete(sock, jid, { gc: true });
    } else if (actionLower === 'status') {
        await toggleAntiDelete(sock, jid, { status: true });
    } else {
        await sock.sendMessage(jid, {
            text: `❌ Option invalide.\n\nOptions: all, pm, gc, status, off`
        });
    }
}

/**
 * Commande Download Video
 */
async function handleDownload(sock, jid, ownerJid, url) {
    if (!url) {
        await sock.sendMessage(jid, {
            text: '❌ Veuillez fournir une URL.\n\nExemple: .dl https://tiktok.com/...'
        });
        return;
    }

    await downloadVideo(sock, url, jid, ownerJid);
}

/**
 * Commande Schedule
 */
async function handleSchedule(sock, jid, fullCommand) {
    try {
        const { scheduledTime, content } = parseScheduleCommand(fullCommand);
        await scheduleStatus(sock, jid, scheduledTime, content);
    } catch (error) {
        await sock.sendMessage(jid, {
            text: `❌ ${error.message}\n\nFormat: .schedule YYYY-MM-DD HH:MM contenu`
        });
    }
}

/**
 * Commande Status
 */
async function handleStatus(sock, jid, userConfig) {
    const ghostStatus = userConfig.ghostMode ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌';

    const statusText = `📊 *État du Bot WBOT*\n\n` +
        `👤 Utilisateur: ${jid.split('@')[0]}\n` +
        `⚙️ Préfixe: ${userConfig.prefix}\n` +
        `👻 Mode Fantôme: ${ghostStatus}\n` +
        `🤖 Bot Version: 1.0.0\n` +
        `✅ Statut: En ligne`;

    await sock.sendMessage(jid, { text: statusText });
}

/**
 * Commande Set Prefix
 */
async function handleSetPrefix(sock, jid, newPrefix) {
    if (!newPrefix || newPrefix.length > 3) {
        await sock.sendMessage(jid, {
            text: '❌ Préfixe invalide. Maximum 3 caractères.\n\nExemple: .setprefix !'
        });
        return;
    }

    const userConfig = await UserConfig.findOne({ where: { jid } });
    if (userConfig) {
        userConfig.prefix = newPrefix;
        await userConfig.save();

        await sock.sendMessage(jid, {
            text: `✅ Préfixe changé en: ${newPrefix}\n\nExemple: ${newPrefix}help`
        });
    }
}

/**
 * Commande Auto-Like Status
 */
async function handleAutoLike(sock, jid, ownerJid, action) {
    const userConfig = await UserConfig.findOne({ where: { jid: ownerJid } });

    if (!action) {
        const isActive = userConfig?.autoLikeStatus || false;
        const emoji = userConfig?.likeEmoji || '❤️';
        await sock.sendMessage(jid, {
            text: `💖 Auto-Like Statuts: ${isActive ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌'}\n` +
                `📝 Emoji actuel: ${emoji}\n\n` +
                `Utilisez \`.autolike on\` ou \`.autolike off\` pour changer.\n` +
                `Changez l'emoji avec \`.setemoji 😊\``
        });
        return;
    }

    const enable = action.toLowerCase() === 'on';
    await toggleAutoLikeStatus(ownerJid, enable);

    await sock.sendMessage(jid, {
        text: `✅ Auto-Like des statuts ${enable ? 'ACTIVÉ' : 'DÉSACTIVÉ'}\n\n` +
            (enable ? `Tous les statuts seront automatiquement likés avec ${userConfig?.likeEmoji || '❤️'}` : '')
    });
}

/**
 * Commande Set Emoji
 */
async function handleSetEmoji(sock, jid, ownerJid, emoji) {
    if (!emoji) {
        await sock.sendMessage(jid, {
            text: '❌ Veuillez fournir un emoji.\n\nExemple: .setemoji 😍'
        });
        return;
    }

    await setLikeEmoji(ownerJid, emoji);

    await sock.sendMessage(jid, {
        text: `✅ Emoji de like changé en: ${emoji}\n\n` +
            `Les statuts seront maintenant likés avec ${emoji}`
    });
}

export default {
    handleMessage
};
