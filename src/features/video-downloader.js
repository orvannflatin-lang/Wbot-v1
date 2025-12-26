import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOWNLOADS_DIR = path.join(__dirname, '../../downloads');

/**
 * Télécharge une vidéo depuis les réseaux sociaux
 * @param {Object} sock - Socket Baileys
 * @param {string} url - URL de la vidéo
 * @param {string} userJid - JID de l'utilisateur
 * @param {string} ownerJid - JID du propriétaire
 */
export async function downloadVideo(sock, url, userJid, ownerJid) {
    try {
        await sock.sendMessage(userJid, { text: '⏳ Téléchargement en cours...' });

        let videoData = null;

        // TikTok
        if (url.includes('tiktok.com')) {
            videoData = await downloadTikTok(url);
        }
        // Instagram
        else if (url.includes('instagram.com')) {
            videoData = await downloadInstagram(url);
        }
        // YouTube
        else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            videoData = await downloadYouTube(url);
        }
        // Facebook
        else if (url.includes('facebook.com') || url.includes('fb.watch')) {
            videoData = await downloadFacebook(url);
        }
        // Twitter/X
        else if (url.includes('twitter.com') || url.includes('x.com')) {
            videoData = await downloadTwitter(url);
        }
        else {
            await sock.sendMessage(userJid, {
                text: '❌ Plateforme non supportée.\n\nPlateformes supportées:\n- TikTok\n- Instagram\n- YouTube\n- Facebook\n- Twitter/X'
            });
            return false;
        }

        if (!videoData || !videoData.videoUrl) {
            await sock.sendMessage(userJid, { text: '❌ Impossible de télécharger cette vidéo.' });
            return false;
        }

        // Télécharger le fichier vidéo
        const videoBuffer = await downloadFile(videoData.videoUrl);
        const filename = `video_${Date.now()}.mp4`;
        const filepath = path.join(DOWNLOADS_DIR, filename);

        fs.writeFileSync(filepath, videoBuffer);

        const caption = `📥 *Vidéo Téléchargée*\n\n` +
            `🔗 Plateforme: ${videoData.platform}\n` +
            `👤 Demandé par: @${userJid.split('@')[0]}\n` +
            (videoData.title ? `📝 Titre: ${videoData.title}\n` : '') +
            `⏰ ${new Date().toLocaleString('fr-FR')}`;

        // Envoyer dans la messagerie du propriétaire
        await sock.sendMessage(ownerJid, {
            video: fs.readFileSync(filepath),
            caption: caption,
            mentions: [userJid]
        });

        // Confirmer à l'utilisateur
        await sock.sendMessage(userJid, {
            text: '✅ Vidéo téléchargée et transférée dans votre messagerie!'
        });

        return true;
    } catch (error) {
        console.error('Erreur downloadVideo:', error);
        await sock.sendMessage(userJid, {
            text: '❌ Erreur lors du téléchargement. Veuillez réessayer.'
        });
        return false;
    }
}

/**
 * Télécharge depuis TikTok
 */
async function downloadTikTok(url) {
    try {
        // Utiliser l'API publique TikTok downloader
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);

        if (response.data.code === 0) {
            return {
                platform: 'TikTok',
                videoUrl: response.data.data.play,
                title: response.data.data.title
            };
        }

        return null;
    } catch (error) {
        console.error('Erreur downloadTikTok:', error);
        return null;
    }
}

/**
 * Télécharge depuis Instagram
 */
async function downloadInstagram(url) {
    try {
        // Utiliser une API publique Instagram downloader
        const apiUrl = `https://api.downloadgram.com/media?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);

        if (response.data && response.data[0]?.video_url) {
            return {
                platform: 'Instagram',
                videoUrl: response.data[0].video_url,
                title: 'Instagram Video'
            };
        }

        return null;
    } catch (error) {
        console.error('Erreur downloadInstagram:', error);
        return null;
    }
}

/**
 * Télécharge depuis YouTube (vidéos courtes)
 */
async function downloadYouTube(url) {
    try {
        // Pour YouTube, on utilise une approche simplifiée avec une API tierce
        const apiUrl = `https://yt-api.p.rapidapi.com/dl?id=${extractYouTubeId(url)}`;
        // Note: Cette API nécessite une clé RapidAPI
        // Alternative: utiliser ytdl-core (à installer)

        return {
            platform: 'YouTube',
            videoUrl: null, // À implémenter avec ytdl-core
            title: 'YouTube Video'
        };
    } catch (error) {
        console.error('Erreur downloadYouTube:', error);
        return null;
    }
}

/**
 * Télécharge depuis Facebook
 */
async function downloadFacebook(url) {
    try {
        // Facebook est plus complexe, utiliser une API tierce
        return {
            platform: 'Facebook',
            videoUrl: null, // À implémenter
            title: 'Facebook Video'
        };
    } catch (error) {
        console.error('Erreur downloadFacebook:', error);
        return null;
    }
}

/**
 * Télécharge depuis Twitter/X
 */
async function downloadTwitter(url) {
    try {
        // Twitter nécessite une API
        return {
            platform: 'Twitter',
            videoUrl: null, // À implémenter
            title: 'Twitter Video'
        };
    } catch (error) {
        console.error('Erreur downloadTwitter:', error);
        return null;
    }
}

/**
 * Télécharge un fichier depuis une URL
 */
async function downloadFile(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}

/**
 * Extrait l'ID d'une vidéo YouTube
 */
function extractYouTubeId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
}

export default {
    downloadVideo
};
