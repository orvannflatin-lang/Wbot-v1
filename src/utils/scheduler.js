import cron from 'node-cron';
import { ScheduledTask, ScheduledStatus } from '../database/schema.js';
import { Op } from 'sequelize';
import fs from 'fs';

/**
 * Initialise le planificateur de tâches
 * @param {object} sock - Le socket WhatsApp connecté
 */
export function initScheduler(sock) {
    // console.log('⏰ [SCHEDULER] Service de planification démarré.');

    // Vérification chaque minute
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        // console.log('⏰ [SCHEDULER] Tick:', now.toLocaleTimeString());

        try {
            await processScheduledTasks(sock, now);
        } catch (error) {
            console.error('❌ [SCHEDULER] Erreur globale:', error);
        }
    });
}

/**
 * Traite les tâches échues
 */
async function processScheduledTasks(sock, now) {
    let tasks = [];

    try {
        // 1. Récupérer les tâches non exécutées et échues
        tasks = await ScheduledTask.findAll({
            where: {
                executed: false,
                triggerTime: { [Op.lte]: now }
            }
        });
    } catch (dbErr) {
        // Silently ignore if table doesn't exist yet (DB not fully synced)
        return;
    }


    if (tasks && tasks.length > 0) {
        console.log(`⏰ [SCHEDULER] ${tasks.length} tâche(s) à exécuter...`);

        for (const task of tasks) {
            try {
                // Action selon le type
                switch (task.actionType) {
                    case 'msg':
                        // Envoi Message
                        if (task.content) {
                            await sock.sendMessage(task.targetJid, { text: task.content });
                            console.log(`✅ [SCHEDULER] Message envoyé à ${task.targetJid}`);
                        }
                        break;

                    case 'status':
                        // Envoi Statut
                        const statusJid = 'status@broadcast';
                        if (task.content) {
                            await sock.sendMessage(statusJid, { text: task.content, backgroundColor: '#333333' });
                            console.log(`✅ [SCHEDULER] Statut texte posté`);
                        } else if (task.mediaPath && fs.existsSync(task.mediaPath)) {
                            // TODO: Support média pour statut (image/video)
                            // Pour l'instant on skip ou on implémente basique
                            console.log(`⚠️ [SCHEDULER] Média statut non supporté via cron pour l'instant`);
                        }
                        break;

                    case 'reminder':
                        // Rappel personnel
                        await sock.sendMessage(task.targetJid, {
                            text: `⏰ *RAPPEL*\n\nVous avez demandé de vous rappeler :\n"${task.content}"`
                        });
                        console.log(`✅ [SCHEDULER] Rappel envoyé à ${task.targetJid}`);
                        break;
                }

                // Marquer comme exécuté
                task.executed = true;
                await task.save();
                // Optionnel: Supprimer directement pour nettoyer
                // await task.destroy();

            } catch (err) {
                console.error(`❌ [SCHEDULER] Echec Tâche ${task.id}:`, err);
            }
        }
    }
}

/**
 * Ajoute une tâche planifiée
 */
export async function scheduleMessage(jid, time, content, type = 'msg') {
    return await ScheduledTask.create({
        targetJid: jid,
        triggerTime: time,
        content: content,
        actionType: type
    });
}
