
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';

const execPromise = util.promisify(exec);

/**
 * .id
 * Récupère l'ID du chat ou de l'utilisateur
 */
export async function handleId(sock, m, args, from) {
    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const participant = m.message.extendedTextMessage?.contextInfo?.participant;

    let targetId = from;
    if (quoted) {
        targetId = participant;
    }

    await sock.sendMessage(from, { text: `🆔 *ID :* ${targetId}` }, { quoted: m });
}

/**
 * .poll
 * Crée un sondage simple
 */
export async function handlePoll(sock, m, args, from) {
    const text = args.join(' ');
    if (!text || !text.includes('|')) return sock.sendMessage(from, {
        text: '📌 *Usage :* .poll Question | Option1 | Option2...'
    }, { quoted: m });

    const [name, ...values] = text.split('|');

    await sock.sendMessage(from, {
        poll: {
            name: name.trim(),
            values: values.map(v => v.trim()),
            selectableCount: 1
        }
    });
}

/**
 * .tovideo
 * Convertit un sticker animé en vidéo (MP4)
 */
export async function handleToVideo(sock, m, args, from) {
    const isQuotedSticker = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
    if (!isQuotedSticker) return sock.sendMessage(from, { text: '❌ Répondez à un sticker animé.' }, { quoted: m });

    try {
        await sock.sendMessage(from, { react: { text: '🔄', key: m.key } });

        const buffer = await downloadMediaMessage(
            { key: m.key, message: m.message.extendedTextMessage.contextInfo.quotedMessage },
            'buffer', {}, { logger: console }
        );

        const inputPath = `./temp_stick_${Date.now()}.webp`;
        const outputPath = `./temp_vid_${Date.now()}.mp4`;

        fs.writeFileSync(inputPath, buffer);

        // Convert WEBP to MP4 using FFmpeg
        await execPromise(`ffmpeg -i ${inputPath} -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${outputPath}`);

        await sock.sendMessage(from, {
            video: fs.readFileSync(outputPath),
            caption: '🎞️ *Sticker converti*'
        }, { quoted: m });

        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: '❌ Erreur Conversion.' }, { quoted: m });
    }
}

/**
 * .pdf
 * Convertit une image en PDF
 */
export async function handlePdf(sock, m, args, from) {
    const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    if (!isQuotedImage) return sock.sendMessage(from, { text: '❌ Répondez à une image.' }, { quoted: m });

    try {
        await sock.sendMessage(from, { react: { text: '📑', key: m.key } });

        const buffer = await downloadMediaMessage(
            { key: m.key, message: m.message.extendedTextMessage.contextInfo.quotedMessage },
            'buffer', {}, { logger: console }
        );

        const inputPath = `./temp_img_${Date.now()}.jpg`;
        const outputPath = `./temp_doc_${Date.now()}.pdf`;

        fs.writeFileSync(inputPath, buffer);

        await execPromise(`ffmpeg -i ${inputPath} ${outputPath}`);

        await sock.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: 'application/pdf',
            fileName: 'document_wbot.pdf'
        }, { quoted: m });

        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: '❌ Erreur PDF (FFmpeg requis).' }, { quoted: m });
    }
}

/**
 * .tempmail
 * Génère une adresse email temporaire
 */
export async function handleTempMail(sock, m, args, from) {
    try {
        await sock.sendMessage(from, { react: { text: '📧', key: m.key } });
        const { data } = await axios.get('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1');
        if (data && data[0]) {
            await sock.sendMessage(from, {
                text: `📧 *Email Temporaire :*\n${data[0]}\n\nPour lire les mails, allez sur 1secmail.com avec ce user.`
            }, { quoted: m });
        } else {
            throw new Error('No mail generated');
        }
    } catch (e) {
        await sock.sendMessage(from, { text: '❌ Erreur TempMail.' }, { quoted: m });
    }
}

/**
 * .qr <texte>
 * Génère un QRCode
 */
export async function handleQR(sock, m, args, from) {
    if (!args[0]) return sock.sendMessage(from, { text: '📌 Usage: .qr <texte/lien>' }, { quoted: m });
    const text = args.join(' ');
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
    await sock.sendMessage(from, { image: { url: url }, caption: '✅ QR Code généré' }, { quoted: m });
}

/**
 * .fakequote <texte>
 * Génère un faux tweet/quote
 */
export async function handleFakeQuote(sock, m, args, from) {
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '📌 Usage: .fakequote <texte>' });

    await sock.sendMessage(from, { text: `❝ ${text} ❞\n\n- ${m.pushName || 'Inconnu'}` }, { quoted: m });
}

/**
 * .ocr
 * Extrait le texte d'une image
 */
export async function handleOCR(sock, m, args, from) {
    const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    if (!isQuotedImage) return sock.sendMessage(from, { text: '❌ Répondez à une image.' }, { quoted: m });

    await sock.sendMessage(from, { react: { text: '👀', key: m.key } });
    try {
        const buffer = await downloadMediaMessage(
            { key: m.key, message: m.message.extendedTextMessage.contextInfo.quotedMessage },
            'buffer', {}, { logger: console }
        );
        const base64 = buffer.toString('base64');
        const res = await axios.post('https://api.ocr.space/parse/image',
            `base64Image=data:image/jpeg;base64,${base64}`,
            { headers: { 'apikey': 'helloworld', 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const parsedText = res.data.ParsedResults?.[0]?.ParsedText;
        if (parsedText) {
            await sock.sendMessage(from, { text: `📝 *TEXTE DÉTECTÉ :*\n\n${parsedText}` }, { quoted: m });
        } else {
            await sock.sendMessage(from, { text: '❌ Aucun texte trouvé.' });
        }
    } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: '❌ Erreur API OCR.' });
    }
}

/**
 * .txt (Audio to Text / Speech Recognition)
 * Transcrit un vocal en texte
 */
export async function handleTranscribe(sock, m, args, from) {
    const isQuotedAudio = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage;
    if (!isQuotedAudio) return sock.sendMessage(from, {
        text: '📌 *Usage Commande .txt*\n\nRépondez à un vocal pour le transcrire en texte.'
    }, { quoted: m });

    await sock.sendMessage(from, { react: { text: '🔊', key: m.key } });

    // Note: La transcription audio nécessite une API comme Google Speech-to-Text, Whisper API, etc.
    // Pour l'instant, on fait un placeholder fonctionnel
    await sock.sendMessage(from, { text: '⚠️ Transcription Audio (API STT requise - En développement)' }, { quoted: m });
}
