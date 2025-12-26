import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Créer les dossiers nécessaires
const DOWNLOADS_DIR = path.join(__dirname, '../../downloads');
const TEMP_DIR = path.join(__dirname, '../../temp');

if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Télécharge un média depuis un message WhatsApp
 * @param {Object} message - Message WhatsApp contenant le média
 * @returns {Promise<{buffer: Buffer, type: string}>}
 */
export async function downloadMedia(message) {
    try {
        const messageType = Object.keys(message)[0];
        const stream = await downloadContentFromMessage(message[messageType], messageType.replace('Message', ''));

        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        return { buffer, type: messageType };
    } catch (error) {
        console.error('Erreur téléchargement média:', error);
        throw error;
    }
}

/**
 * Sauvegarde un buffer en fichier local
 * @param {Buffer} buffer - Buffer du média
 * @param {string} type - Type de média
 * @param {string} prefix - Préfixe du nom de fichier
 * @returns {Promise<string>} - Chemin du fichier sauvegardé
 */
export async function saveMediaToFile(buffer, type, prefix = 'media') {
    const extensions = {
        imageMessage: '.jpg',
        videoMessage: '.mp4',
        audioMessage: '.mp3',
        documentMessage: '.pdf',
        stickerMessage: '.webp'
    };

    const ext = extensions[type] || '.bin';
    const filename = `${prefix}_${Date.now()}${ext}`;
    const filepath = path.join(DOWNLOADS_DIR, filename);

    fs.writeFileSync(filepath, buffer);
    return filepath;
}

/**
 * Obtient le type MIME depuis le type de message
 * @param {string} messageType - Type de message WhatsApp
 * @returns {string} - Type MIME
 */
export function getMimeType(messageType) {
    const mimeTypes = {
        imageMessage: 'image/jpeg',
        videoMessage: 'video/mp4',
        audioMessage: 'audio/mpeg',
        documentMessage: 'application/pdf',
        stickerMessage: 'image/webp'
    };

    return mimeTypes[messageType] || 'application/octet-stream';
}

/**
 * Nettoie les fichiers temporaires anciens (> 1 heure)
 */
export function cleanTempFiles() {
    try {
        const files = fs.readdirSync(TEMP_DIR);
        const now = Date.now();

        files.forEach(file => {
            const filepath = path.join(TEMP_DIR, file);
            const stats = fs.statSync(filepath);
            const age = now - stats.mtimeMs;

            if (age > 3600000) { // 1 heure
                fs.unlinkSync(filepath);
            }
        });
    } catch (error) {
        console.error('Erreur nettoyage fichiers temp:', error);
    }
}

// Nettoyer les fichiers temp toutes les heures
setInterval(cleanTempFiles, 3600000);

export { DOWNLOADS_DIR, TEMP_DIR };
