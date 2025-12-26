import cron from 'node-cron';
import { ScheduledStatus, UserConfig } from '../database/schema.js';
import fs from 'fs';

const cronJobs = new Map(); // Map de ID -> cron job

/**
 * Programme un statut à poster à une date/heure spécifique
 * @param {Object} sock - Socket Baileys
 * @param {string} userJid - JID de l'utilisateur
 * @param {Date} scheduledTime - Date et heure de publication
 * @param {string} content - Contenu texte du statut
 * @param {string} mediaPath - Chemin du média (optionnel)
 * @param {string} mediaType - Type de média (optionnel)
 */
export async function scheduleStatus(sock, userJid, scheduledTime, content, mediaPath = null, mediaType = null) {
    try {
        // Créer l'entrée en DB
        const scheduled = await ScheduledStatus.create({
            userJid,
            content,
            mediaPath,
            mediaType,
            scheduledTime,
            posted: false
        });

        // Créer le cron job
        const cronExpression = getCronExpression(scheduledTime);
        const job = cron.schedule(cronExpression, async () => {
            await postScheduledStatus(sock, scheduled.id);
        });

        cronJobs.set(scheduled.id, job);

        await sock.sendMessage(userJid, {
            text: `⏰ *Statut Programmé*\n\n` +
                `📅 Date: ${scheduledTime.toLocaleDateString('fr-FR')}\n` +
                `🕐 Heure: ${scheduledTime.toLocaleTimeString('fr-FR')}\n` +
                `📝 Contenu: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`
        });

        return true;
    } catch (error) {
        console.error('Erreur scheduleStatus:', error);
        return false;
    }
}

/**
 * Poste un statut programmé
 * @param {Object} sock - Socket Baileys
 * @param {number} scheduledId - ID du statut programmé
 */
async function postScheduledStatus(sock, scheduledId) {
    try {
        const scheduled = await ScheduledStatus.findByPk(scheduledId);

        if (!scheduled || scheduled.posted) {
            return;
        }

        // Préparer le message de statut
        const statusMessage = {
            text: scheduled.content
        };

        // Si média présent
        if (scheduled.mediaPath && fs.existsSync(scheduled.mediaPath)) {
            if (scheduled.mediaType === 'imageMessage') {
                statusMessage.image = fs.readFileSync(scheduled.mediaPath);
                statusMessage.caption = scheduled.content;
                delete statusMessage.text;
            } else if (scheduled.mediaType === 'videoMessage') {
                statusMessage.video = fs.readFileSync(scheduled.mediaPath);
                statusMessage.caption = scheduled.content;
                delete statusMessage.text;
            }
        }

        // Poster le statut (broadcast)
        await sock.sendMessage('status@broadcast', statusMessage);

        // Marquer comme posté
        scheduled.posted = true;
        await scheduled.save();

        // Supprimer le cron job
        const job = cronJobs.get(scheduledId);
        if (job) {
            job.stop();
            cronJobs.delete(scheduledId);
        }

        // Notifier l'utilisateur
        await sock.sendMessage(scheduled.userJid, {
            text: `✅ Votre statut programmé a été publié avec succès!`
        });

        console.log(`✅ Statut programmé ${scheduledId} posté`);
    } catch (error) {
        console.error('Erreur postScheduledStatus:', error);
    }
}

/**
 * Convertit une Date en expression cron
 * @param {Date} date - Date cible
 * @returns {string} - Expression cron
 */
function getCronExpression(date) {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;

    return `${minute} ${hour} ${dayOfMonth} ${month} *`;
}

/**
 * Parse une commande de planification
 * Exemple: .schedule 2025-12-26 14:30 Mon statut cool
 * @param {string} text - Texte de la commande
 * @returns {Object} - {scheduledTime, content}
 */
export function parseScheduleCommand(text) {
    try {
        // Format: .schedule YYYY-MM-DD HH:MM contenu
        const parts = text.split(' ');

        if (parts.length < 4) {
            throw new Error('Format invalide. Utilisez: .schedule YYYY-MM-DD HH:MM contenu');
        }

        const dateStr = parts[1]; // YYYY-MM-DD
        const timeStr = parts[2]; // HH:MM
        const content = parts.slice(3).join(' ');

        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);

        const scheduledTime = new Date(year, month - 1, day, hour, minute);

        // Vérifier que la date est dans le futur
        if (scheduledTime <= new Date()) {
            throw new Error('La date doit être dans le futur');
        }

        return { scheduledTime, content };
    } catch (error) {
        throw error;
    }
}

/**
 * Restaure les statuts programmés au démarrage
 * @param {Object} sock - Socket Baileys
 */
export async function restoreScheduledStatuses(sock) {
    try {
        const pending = await ScheduledStatus.findAll({
            where: { posted: false }
        });

        const now = new Date();

        for (const scheduled of pending) {
            if (new Date(scheduled.scheduledTime) <= now) {
                // Si la date est passée, poster immédiatement
                await postScheduledStatus(sock, scheduled.id);
            } else {
                // Sinon, recréer le cron job
                const cronExpression = getCronExpression(new Date(scheduled.scheduledTime));
                const job = cron.schedule(cronExpression, async () => {
                    await postScheduledStatus(sock, scheduled.id);
                });
                cronJobs.set(scheduled.id, job);
            }
        }

        console.log(`✅ ${pending.length} statuts programmés restaurés`);
    } catch (error) {
        console.error('Erreur restoreScheduledStatuses:', error);
    }
}

export default {
    scheduleStatus,
    parseScheduleCommand,
    restoreScheduledStatuses
};
