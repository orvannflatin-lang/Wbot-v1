import { downloadWithYtdlp, downloadAudioMp3 } from '../utils/ytdlp-handler.js';
import axios from 'axios';

/**
 * .dl <url>
 * Télécharge une vidéo (TikTok, YouTube, Instagram, etc.)
 */
export async function handleDownload(sock, m, args, from) {
    if (!args[0]) return sock.sendMessage(from, {
        text: '📌 *Usage:* .dl <lien>\n\n🎬 Plateformes supportées: YouTube, TikTok, Instagram, Facebook'
    }, { quoted: m });

    const url = args[0];
    await sock.sendMessage(from, { react: { text: '⬇️', key: m.key } });

    try {
        const videoPath = await downloadWithYtdlp(url);

        await sock.sendMessage(from, {
            video: { url: videoPath },
            caption: '✅ Vidéo téléchargée'
        }, { quoted: m });
    } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: '❌ Erreur téléchargement. Vérifiez le lien ou installez yt-dlp.' }, { quoted: m });
    }
}

/**
 * .lyrics <titre chanson>
 * Récupère les paroles d'une chanson
 */
export async function handleLyrics(sock, m, args, from) {
    if (!args[0]) return sock.sendMessage(from, {
        text: '📌 *Usage:* .lyrics <titre chanson>\n\nExemple: .lyrics Bohemian Rhapsody'
    }, { quoted: m });

    const query = args.join(' ');
    await sock.sendMessage(from, { react: { text: '🎵', key: m.key } });

    try {
        // API Lyrics gratuite (lyrics.ovh ou alternatives)
        const res = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(query.split(' ')[0])}/${encodeURIComponent(query)}`);

        if (res.data && res.data.lyrics) {
            const lyrics = res.data.lyrics.substring(0, 4000); // Limite WhatsApp
            await sock.sendMessage(from, {
                text: `🎵 *${query}*\n\n${lyrics}`
            }, { quoted: m });
        } else {
            throw new Error('No lyrics found');
        }
    } catch (e) {
        await sock.sendMessage(from, { text: '❌ Paroles introuvables. Vérifiez le titre.' }, { quoted: m });
    }
}
