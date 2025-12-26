import { downloadMedia, saveMediaToFile } from '../utils/media-handler.js';
import { SavedStatus, UserConfig } from '../database/schema.js';
import fs from 'fs';

/**
 * Gère la sauvegarde des statuts WhatsApp
 * @param {Object} sock - Socket Baileys
 * @param {Object} message - Message reçu
 * @param {string} ownerJid - JID du propriétaire
 */
export async function handleStatusSave(sock, message, ownerJid) {
    try {
        // Vérifier si c'est une réponse à un statut
        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isStatusReply = message.key.remoteJid?.endsWith('@broadcast');

        if (!quotedMsg && !isStatusReply) {
            return false;
        }

        const senderJid = message.key.remoteJid;
        const repliedText = message.message?.extendedTextMessage?.text || message.message?.conversation || '';

        // Vérifier le préfixe
        const userConfig = await UserConfig.findOne({ where: { jid: ownerJid } });
        const prefix = userConfig?.prefix || '.';

        if (!repliedText.toLowerCase().startsWith(`${prefix}dlstatus`)) {
            return false;
        }

        let mediaPath = null;
        let content = null;
        let mediaType = null;

        // Si le statut contient un média
        if (quotedMsg?.imageMessage || quotedMsg?.videoMessage) {
            const { buffer, type } = await downloadMedia(quotedMsg);
            mediaPath = await saveMediaToFile(buffer, type, 'status');
            mediaType = type;
        }

        // Si le statut est textuel
        if (quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text) {
            content = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text;
        }

        // Sauvegarder en DB
        await SavedStatus.create({
            statusId: message.key.id,
            fromJid: message.message.extendedTextMessage?.contextInfo?.participant || senderJid,
            savedByJid: ownerJid,
            mediaPath,
            content,
            mediaType
        });

        // Préparer le message pour l'owner
        const fromUser = message.message.extendedTextMessage?.contextInfo?.participant || senderJid;
        const caption = `📊 *Statut Sauvegardé*\n\n` +
            `👤 Statut de: @${fromUser.split('@')[0]}\n` +
            (content ? `📝 Texte: ${content}\n` : '') +
            `⏰ ${new Date().toLocaleString('fr-FR')}`;

        // Envoyer dans la messagerie du propriétaire
        if (mediaType === 'imageMessage') {
            await sock.sendMessage(ownerJid, {
                image: fs.readFileSync(mediaPath),
                caption: caption,
                mentions: [fromUser]
            });
        } else if (mediaType === 'videoMessage') {
            await sock.sendMessage(ownerJid, {
                video: fs.readFileSync(mediaPath),
                caption: caption,
                mentions: [fromUser]
            });
        } else if (content) {
            await sock.sendMessage(ownerJid, {
                text: caption,
                mentions: [fromUser]
            });
        }

        console.log('✅ Statut sauvegardé et transféré');
        return true;
    } catch (error) {
        console.error('Erreur handleStatusSave:', error);
        return false;
    }
}
