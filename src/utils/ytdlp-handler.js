import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Utilitaire pour yt-dlp - Téléchargement média universel
 */

/**
 * Télécharge une vidéo/audio avec yt-dlp
 * @param {string} url - URL à télécharger
 * @param {object} options - Options de téléchargement
 * @returns {Promise<string>} - Chemin du fichier téléchargé
 */
export async function downloadWithYtdlp(url, options = {}) {
    const {
        format = 'best',        // 'best', 'bestaudio', 'worst'
        outputTemplate = '/tmp/%(id)s.%(ext)s'
    } = options;

    // Suppression limite taille (ou très large)
    const cmd = `yt-dlp -f ${format} -o "${outputTemplate}" "${url}"`;

    try {
        const { stdout, stderr } = await execAsync(cmd);

        // Extraire le nom du fichier depuis la sortie
        const match = stdout.match(/\[download\] Destination: (.+)/);
        if (!match) {
            throw new Error('Impossible de déterminer le fichier téléchargé');
        }

        const filepath = match[1].trim();

        // Vérifier que le fichier existe
        if (!fs.existsSync(filepath)) {
            throw new Error('Fichier téléchargé introuvable');
        }

        return filepath;
    } catch (error) {
        // Gérer les erreurs spécifiques
        throw new Error(`Échec téléchargement: ${error.message}`);
    }
}

/**
 * Télécharge uniquement l'audio en MP3
 */
export async function downloadAudioMp3(url) {
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const outputTemplate = `/tmp/%(id)s_${uniqueId}.mp3`;
    // FIX: WinError 32 -> avoid .part files and force overwrite
    const cmd = `yt-dlp -x --audio-format mp3 --audio-quality 0 --no-part --force-overwrites -o "${outputTemplate}" "${url}"`;

    try {
        const { stdout } = await execAsync(cmd);
        const match = stdout.match(/\[ExtractAudio\] Destination: (.+)/);

        if (!match) {
            throw new Error('Impossible de trouver le fichier MP3');
        }

        const filepath = match[1].trim();

        if (!fs.existsSync(filepath)) {
            throw new Error('Fichier MP3 introuvable');
        }

        return filepath;
    } catch (error) {
        throw new Error(`Échec extraction audio: ${error.message}`);
    }
}

/**
 * Obtient la taille d'un fichier
 */
export function getFileSize(filepath) {
    const stats = fs.statSync(filepath);
    return stats.size;
}

/**
 * Supprime un fichier de manière sécurisée
 */
export function cleanupFile(filepath) {
    try {
        if (filepath && fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log(`🧹 Fichier supprimé: ${path.basename(filepath)}`);
            return true;
        }
    } catch (error) {
        console.error(`❌ Erreur suppression fichier: ${error.message}`);
    }
    return false;
}

/**
 * Met à jour yt-dlp
 */
export async function updateYtdlp() {
    try {
        await execAsync('yt-dlp -U');
        console.log('✅ yt-dlp mis à jour');
        return true;
    } catch (error) {
        console.log('⚠️ Mise à jour yt-dlp échouée (peut-être déjà à jour)');
        return false;
    }
}
