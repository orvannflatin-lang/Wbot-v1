import { getMessage } from '../utils/store-messages.js';
import { UserConfig } from '../database/schema.js';
import { downloadMedia, saveMediaToFile } from '../utils/media-handler.js';
import fs from 'fs';

/**
 * Gère l'antidelete - détecte et transfère les messages supprimés
 * @param {Object} sock - Socket Baileys
 * @param {Object} update - Update contenant l'info de suppression
 * @param {string} ownerJid - JID du propriétaire
 */
export async function handleAntiDelete(sock, update, ownerJid) {
    try {
        // Vérifier si c'est une suppression (protocolMessage)
        if (update.update?.protocolMessage?.type !== 1) return; // Type 1 = REVOKE (suppression)
        
        const deletedMessageId = update.update.protocolMessage?.key?.id;
        const deletedMessageKey = update.key;
        
        if (!deletedMessageId) return;

        // Récupérer la config de l'utilisateur
        const userConfig = await UserConfig.findOne({ where: { jid: ownerJid } });
        if (!userConfig || !userConfig.antidelete) return;

        // Récupérer le message original depuis le store
        const originalMessage = getMessage(deletedMessageId);
        if (!originalMessage || !originalMessage.message) return;

        // Vérifier les paramètres antidelete (pm, gc, status, etc.)
        const antideleteSettings = JSON.parse(userConfig.antidelete || '{}');
        const remoteJid = deletedMessageKey.remoteJid || originalMessage.key?.remoteJid;
        
        if (!remoteJid) return;

        // Déterminer le type de conversation
        const isGroup = remoteJid.endsWith('@g.us');
        const isStatus = remoteJid === 'status@broadcast';
        const isPM = !isGroup && !isStatus;

        // Vérifier si l'antidelete est activé pour ce type
        let shouldProcess = false;
        
        if (antideleteSettings.all || antideleteSettings === true) {
            shouldProcess = true;
        } else if (antideleteSettings.pm && isPM) {
            shouldProcess = true;
        } else if (antideleteSettings.gc && isGroup) {
            shouldProcess = true;
        } else if (antideleteSettings.status && isStatus) {
            shouldProcess = true;
        }

        if (!shouldProcess) return;

        // Informations sur le message supprimé
        const senderJid = originalMessage.key?.participant || originalMessage.key?.remoteJid;
        const deleteTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        // Obtenir le nom du groupe ou de la personne
        let sourceName = '';
        if (isGroup) {
            try {
                const groupInfo = await sock.groupMetadata(remoteJid);
                sourceName = `👥 Groupe: ${groupInfo.subject}`;
            } catch {
                sourceName = `👥 Groupe`;
            }
        } else if (isStatus) {
            sourceName = `📊 Statut`;
        } else {
            sourceName = `💬 Privé`;
        }

        // Récupérer le contenu du message
        const message = originalMessage.message;
        const messageType = Object.keys(message)[0];

        // Préparer le message d'alerte
        const senderName = senderJid?.split('@')[0] || 'Inconnu';
        const alertText = `\n✨ *WBOT ANTI-DELETE* ✨\n\n` +
            `👤 Envoyé par: @${senderName}\n` +
            `🗑️ Supprimé par: @${originalMessage.key?.fromMe ? senderName : 'Autre utilisateur'}\n` +
            `⏰ Heure de suppression: ${deleteTime}\n` +
            `${sourceName}\n\n`;

        // Traiter selon le type de message
        if (message.conversation || message.extendedTextMessage) {
            // Message texte
            const text = message.conversation || message.extendedTextMessage?.text || '📝 Message supprimé (vide)';
            
            await sock.sendMessage(ownerJid, {
                text: alertText + `📝 *Message:*\n${text}`,
                mentions: [senderJid].filter(Boolean)
            });
        } else if (message.imageMessage || message.videoMessage || message.audioMessage || message.documentMessage || message.stickerMessage) {
            // Message média
            try {
                const { buffer, type } = await downloadMedia(message);
                const filepath = await saveMediaToFile(buffer, type, 'antidelete');

                let mediaMessage = {
                    caption: alertText,
                    mentions: [senderJid].filter(Boolean)
                };

                if (type === 'imageMessage') {
                    mediaMessage.image = fs.readFileSync(filepath);
                } else if (type === 'videoMessage') {
                    mediaMessage.video = fs.readFileSync(filepath);
                } else if (type === 'audioMessage') {
                    mediaMessage.audio = fs.readFileSync(filepath);
                    mediaMessage.mimetype = message.audioMessage?.mimetype || 'audio/mp4';
                } else if (type === 'documentMessage') {
                    mediaMessage.document = fs.readFileSync(filepath);
                    mediaMessage.mimetype = message.documentMessage?.mimetype || 'application/octet-stream';
                    mediaMessage.fileName = message.documentMessage?.fileName || 'document';
                } else if (type === 'stickerMessage') {
                    mediaMessage.sticker = fs.readFileSync(filepath);
                }

                await sock.sendMessage(ownerJid, mediaMessage);
            } catch (error) {
                console.error('Erreur téléchargement média antidelete:', error);
                await sock.sendMessage(ownerJid, {
                    text: alertText + `📎 *Média supprimé* (erreur de récupération)`
                });
            }
        } else {
            // Autre type de message - forward
            try {
                await sock.sendMessage(ownerJid, {
                    text: alertText + `📎 *Message supprimé*`,
                    mentions: [senderJid].filter(Boolean)
                });
                
                // Essayer de forwarder le message original si possible
                await sock.sendMessage(ownerJid, {
                    forward: originalMessage,
                    contextInfo: {
                        externalAdReply: {
                            title: '📎 Message supprimé récupéré'
                        }
                    }
                });
            } catch (error) {
                console.error('Erreur forward message:', error);
            }
        }

        console.log(`✅ Message supprimé récupéré: ${deletedMessageId}`);
        return true;
    } catch (error) {
        console.error('Erreur handleAntiDelete:', error);
        return false;
    }
}

/**
 * Active/désactive l'antidelete
 * @param {Object} sock - Socket Baileys
 * @param {string} userJid - JID de l'utilisateur
 * @param {boolean|Object} settings - true/false ou objet avec {all, pm, gc, status}
 */
export async function toggleAntiDelete(sock, userJid, settings) {
    try {
        const [userConfig] = await UserConfig.findOrCreate({
            where: { jid: userJid },
            defaults: { jid: userJid, antidelete: '{}' }
        });

        let antideleteValue = '{}';
        
        if (typeof settings === 'boolean') {
            // Mode simple: true/false
            antideleteValue = settings ? JSON.stringify({ all: true }) : '{}';
        } else if (typeof settings === 'object') {
            // Mode avancé: spécifier les types
            antideleteValue = JSON.stringify(settings);
        }

        userConfig.antidelete = antideleteValue;
        await userConfig.save();

        const status = antideleteValue !== '{}' ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ❌';
        const settingsObj = JSON.parse(antideleteValue);
        
        let detailText = '';
        if (settingsObj.all) {
            detailText = 'Mode: Tous les messages';
        } else {
            const modes = [];
            if (settingsObj.pm) modes.push('Privés');
            if (settingsObj.gc) modes.push('Groupes');
            if (settingsObj.status) modes.push('Statuts');
            detailText = modes.length > 0 ? `Mode: ${modes.join(', ')}` : 'Aucun mode activé';
        }

        await sock.sendMessage(userJid, {
            text: `🔒 *Anti-Delete*\n\n` +
                `Statut: ${status}\n` +
                `${detailText}\n\n` +
                `💡 Commandes:\n` +
                `.antidelete all - Activer pour tout\n` +
                `.antidelete pm - Activer pour privés\n` +
                `.antidelete gc - Activer pour groupes\n` +
                `.antidelete status - Activer pour statuts\n` +
                `.antidelete off - Désactiver`
        });

        return true;
    } catch (error) {
        console.error('Erreur toggleAntiDelete:', error);
        return false;
    }
}

/**
 * Vérifie si l'antidelete est activé
 * @param {string} userJid - JID de l'utilisateur
 * @returns {boolean}
 */
export async function isAntiDeleteActive(userJid) {
    try {
        const userConfig = await UserConfig.findOne({ where: { jid: userJid } });
        if (!userConfig || !userConfig.antidelete) return false;
        
        const settings = JSON.parse(userConfig.antidelete || '{}');
        return settings.all === true || Object.values(settings).some(v => v === true);
    } catch {
        return false;
    }
}

export default {
    handleAntiDelete,
    toggleAntiDelete,
    isAntiDeleteActive
};



