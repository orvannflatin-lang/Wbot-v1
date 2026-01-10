import fs from 'fs';
import path from 'path';
import { SavedViewOnce, SavedStatus, ScheduledStatus } from '../database/schema.js';
import { Op } from 'sequelize';

/**
 * Nettoyage Automatique des Données Obsolètes
 * Pour éviter de saturer le disque et la base de données.
 */
export async function cleanOldData() {
    // console.log('🧹 [AUTO-CLEAN] Démarrage du nettoyage...');

    const DAYS_TO_KEEP = 3; // Garder 3 jours d'historique (ajustable)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);

    let deletedCount = 0;
    let deletedFiles = 0;

    try {
        // 1. Nettoyer Vues Uniques Sauvegardées > 3 jours
        const oldViewOnce = await SavedViewOnce.findAll({
            where: { createdAt: { [Op.lt]: cutoffDate } }
        });

        for (const record of oldViewOnce) {
            if (record.mediaPath && fs.existsSync(record.mediaPath)) {
                fs.unlinkSync(record.mediaPath);
                deletedFiles++;
            }
            await record.destroy();
            deletedCount++;
        }

        // 2. Nettoyer Statuts Sauvegardés > 3 jours
        const oldStatus = await SavedStatus.findAll({
            where: { createdAt: { [Op.lt]: cutoffDate } }
        });

        for (const record of oldStatus) {
            if (record.mediaPath && fs.existsSync(record.mediaPath)) {
                fs.unlinkSync(record.mediaPath);
                deletedFiles++;
            }
            await record.destroy();
            deletedCount++;
        }

        // 3. Nettoyer Statuts Planifiés (Déjà postés et vieux)
        const oldScheduled = await ScheduledStatus.findAll({
            where: {
                posted: true,
                updatedAt: { [Op.lt]: cutoffDate }
            }
        });

        for (const record of oldScheduled) {
            if (record.mediaPath && fs.existsSync(record.mediaPath)) {
                fs.unlinkSync(record.mediaPath);
                deletedFiles++;
            }
            await record.destroy();
            deletedCount++;
        }

        // 4. Nettoyer dossier temp/ si fichiers > 24h
        const tempDir = './temp';
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            const now = Date.now();
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) { // 24h
                        // Tentative suppression sécurisée (EPERM fix)
                        try {
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                                deletedFiles++;
                            }
                        } catch (err) {
                            if (err.code !== 'EPERM' && err.code !== 'EBUSY') {
                                console.warn(`⚠️ [AUTO-CLEAN] Impossible de supprimer ${file}: ${err.message}`);
                            }
                        }
                    }
                } catch (e) {
                    // Ignorer potentielle erreur stat
                }
            }
        }

        if (deletedCount > 0 || deletedFiles > 0) {
            // console.log(`✨ [AUTO-CLEAN] Terminé: ${deletedCount} entrées DB supprimées, ${deletedFiles} fichiers effacés.`);
        } else {
            // console.log('✅ [AUTO-CLEAN] Rien à nettoyer.');
        }

        return { deletedCount, deletedFiles };

    } catch (error) {
        console.error('❌ [AUTO-CLEAN] Erreur:', error);
        return { error: error.message };
    }
}
