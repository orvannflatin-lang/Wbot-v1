import { downloadMedia, saveMediaToFile } from '../utils/media-handler.js';
import { SavedViewOnce, UserConfig } from '../database/schema.js';
import fs from 'fs';

/**
 * Gère la sauvegarde des vues uniques (view once messages)
 * @param {Object} sock - Socket Baileys
 * @param {Object} message - Message reçu
 * @param {string} ownerJid - JID du propriétaire
 */
export async function handleViewOnce(sock, message, ownerJid) {
    try {
        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Vérifier si c'est une réponse à une vue unique
        if (!quotedMsg?.viewOnceMessageV2 && !quotedMsg?.viewOnceMessage) {
            return false;
        }

        const senderJid = message.key.remoteJid;
        const repliedText = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

        // Vérifier le préfixe
        const userConfig = await UserConfig.findOne({ where: { jid: senderJid } });
        const prefix = userConfig?.prefix || '.';

        if (!repliedText.toLowerCase().startsWith(`${prefix}save`)) {
            return false;
        }

        // Extraire le message de la vue unique
        const viewOnceMsg = quotedMsg.viewOnceMessageV2?.message || quotedMsg.viewOnceMessage;

        if (!viewOnceMsg) {
            await sock.sendMessage(senderJid, { text: '❌ Impossible de récupérer la vue unique.' });
            return true;
        }

        // Télécharger le média
        const { buffer, type } = await downloadMedia(viewOnceMsg);
        const filepath = await saveMediaToFile(buffer, type, 'viewonce');

        // Sauvegarder en DB
        await SavedViewOnce.create({
            messageId: message.key.id,
            fromJid: message.message.extendedTextMessage.contextInfo.participant || senderJid,
            savedByJid: senderJid,
            mediaPath: filepath,
            mediaType: type
        });

        // Préparer le message pour l'owner
        const caption = `📸 *Vue Unique Sauvegardée*\n\n` +
            `👤 De: @${(message.message.extendedTextMessage.contextInfo.participant || senderJid).split('@')[0]}\n` +
            `💾 Sauvegardée par: @${senderJid.split('@')[0]}`;

        // Envoyer dans la messagerie du propriétaire (vue normale)
        if (type === 'imageMessage') {
            await sock.sendMessage(ownerJid, {
                image: fs.readFileSync(filepath),
                caption: caption,
                mentions: [senderJid, message.message.extendedTextMessage.contextInfo.participant || senderJid]
            });
        } else if (type === 'videoMessage') {
            await sock.sendMessage(ownerJid, {
                video: fs.readFileSync(filepath),
                caption: caption,
                mentions: [senderJid, message.message.extendedTextMessage.contextInfo.participant || senderJid]
            });
        }

        // Confirmer à l'utilisateur
        await sock.sendMessage(senderJid, {
            text: '✅ Vue unique sauvegardée et transférée dans votre messagerie!'
        });

        return true;
    } catch (error) {
        console.error('Erreur handleViewOnce:', error);
        return false;
    }
}
