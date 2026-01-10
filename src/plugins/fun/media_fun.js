
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import axios from 'axios';

const execPromise = util.promisify(exec);

// Helper file cleanup
const cleanup = (files) => {
    files.forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    });
};

/**
 * .anime
 * Retrouve l'anime via une image (Trace.moe)
 */
export async function handleAnime(sock, m, args, from) {
    const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    if (!isQuotedImage) return sock.sendMessage(from, {
        text: `📌 *Usage Commande .anime*\n\nRépondez à une image d'un anime (screenshot) pour retrouver son titre et l'épisode.`
    }, { quoted: m });

    await sock.sendMessage(from, { react: { text: '🔍', key: m.key } });

    try {
        // DL Image
        const buffer = await downloadMediaMessage(
            { key: m.key, message: m.message.extendedTextMessage.contextInfo.quotedMessage },
            'buffer', {}, { logger: console }
        );

        // Upload to trace.moe (Max 10MB)
        // Note: Trace.moe API requires image URL or base64 POST
        // On va poster en binary si possible ou url

        // Pour faire simple, on utilise l'API publique
        // Attention: l'API publique a des limites strictes.

        const response = await axios.post('https://api.trace.moe/search', buffer, {
            headers: { 'Content-Type': 'image/jpeg' }
        });

        const result = response.data.result?.[0];
        if (!result) return sock.sendMessage(from, { text: '❌ Anime introuvable.' });

        const confidence = (result.similarity * 100).toFixed(1);
        const caption = `⛩️ *ANIME TROUVÉ*\n\n🎬 *Titre*: ${result.filename}\n⏱️ *Time*: ${result.from}s\n📊 *Confiance*: ${confidence}%\n🔗 *Vidéo*: ${result.video}`;

        await sock.sendMessage(from, { video: { url: result.video }, caption: caption }, { quoted: m });

    } catch (e) {
        console.error('Anime Error', e);
        await sock.sendMessage(from, { text: '❌ Erreur API Anime.' });
    }
}

/**
 * .pack
 * Crée un sticker avec metadata "Pack"
 */
export async function handlePack(sock, m, args, from, senderName) {
    const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    if (!isQuotedImage) return sock.sendMessage(from, { text: '❌ Répondez à une image.' }, { quoted: m });

    try {
        const buffer = await downloadMediaMessage(
            { key: m.key, message: m.message.extendedTextMessage.contextInfo.quotedMessage },
            'buffer', {}, { logger: console }
        );

        const sticker = new Sticker(buffer, {
            pack: args[0] || 'WBOT Pack',
            author: senderName || 'WBOT',
            type: StickerTypes.FULL,
            quality: 70
        });

        await sock.sendMessage(from, { sticker: await sticker.toBuffer() }, { quoted: m });

    } catch (e) {
        console.error('Pack Error', e);
        await sock.sendMessage(from, { text: '❌ Erreur Sticker.' });
    }
}

/**
 * .voice [effet]
 * Change la voix d'un audio.
 */
export async function handleVoice(sock, m, args, from) {
    const isQuotedAudio = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage;
    if (!isQuotedAudio) return sock.sendMessage(from, {
        text: `📌 *Usage Commande .voice*\n\n1️⃣ Répondez à un vocal ou une musique\n2️⃣ Ajoutez l'effet : *.voice robot*\n\n🎧 *Effets :* robot, bebe, ecureuil, lourd, rapide`
    }, { quoted: m });

    const effect = args[0]?.toLowerCase();
    const filters = {
        'robot': 'asetrate=44100*0.5,atempo=2',
        'bebe': 'asetrate=44100*1.5,atempo=0.6',
        'ecureuil': 'asetrate=44100*2',
        'lourd': 'atempo=0.7',
        'rapide': 'atempo=1.5'
    };

    if (!filters[effect]) {
        return sock.sendMessage(from, { text: `🎙️ *Effet '${effect || 'VIDE'}' inconnu*\n\nUtilisez : ${Object.keys(filters).join(', ')}` }, { quoted: m });
    }

    try {
        await sock.sendMessage(from, { react: { text: '🎤', key: m.key } });

        // DL Audio
        const buffer = await downloadMediaMessage(
            { key: m.key, message: m.message.extendedTextMessage.contextInfo.quotedMessage },
            'buffer', {}, { logger: console }
        );

        const inputPath = `./temp_voice_${Date.now()}.ogg`;
        const outputPath = `./temp_voice_out_${Date.now()}.ogg`;

        fs.writeFileSync(inputPath, buffer);

        // FFMPEG Process (Convert to OGG OPUS for WhatsApp Voice Note)
        await execPromise(`ffmpeg -i ${inputPath} -filter_complex "${filters[effect]}" -c:a libopus -b:a 16k -vbr on -compression_level 10 ${outputPath}`);

        await sock.sendMessage(from, {
            audio: fs.readFileSync(outputPath),
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: m });

        cleanup([inputPath, outputPath]);

    } catch (e) {
        console.error('Voice Error', e);
        await sock.sendMessage(from, { text: '❌ Erreur Conversion Voice (FFmpeg manquant ?)' });
    }
}
