import fs from 'fs';
import path from 'path';
import { RemoveBgResultAndBlob, removeBackgroundFromImageFile } from 'remove.bg';
import Tesseract from 'tesseract.js';
import { exec } from 'child_process';
import axios from 'axios';

// Clés API (chargées depuis process.env)
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_KEY;

/**
 * Détourage d'image via Remove.bg
 * @param {string} imagePath - Chemin local de l'image
 * @returns {Promise<string>} - Chemin de l'image détourée (PNG)
 */
export async function removeBg(imagePath) {
    if (!REMOVE_BG_API_KEY) throw new Error('Clé API Remove.bg manquante !');

    const outputFile = imagePath.replace(/\.\w+$/, '_nobg.png');

    try {
        const result = await removeBackgroundFromImageFile({
            path: imagePath,
            apiKey: REMOVE_BG_API_KEY,
            size: 'regular',
            type: 'auto',
        });

        fs.writeFileSync(outputFile, result.base64img, 'base64');
        return outputFile;
    } catch (e) {
        // Fallback: Si erreur (ex: rate limit), on renvoie l'erreur
        throw new Error(`RemoveBG Error: ${JSON.stringify(e)}`);
    }
}

/**
 * Extraction de texte (OCR) via Tesseract
 * @param {string} imagePath 
 */
export async function ocrImage(imagePath) {
    try {
        const { data: { text } } = await Tesseract.recognize(imagePath, 'eng+fra'); // Anglais + Français
        return text.trim();
    } catch (e) {
        throw new Error('Echec OCR: ' + e.message);
    }
}

/**
 * Conversion Sticker (WebP) vers Image (PNG) via ffmpeg
 */
export async function stickerToImage(webpPath) {
    const pngPath = webpPath.replace('.webp', '.png');
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -y -i "${webpPath}" "${pngPath}"`, (err) => {
            if (err) reject(err);
            else resolve(pngPath);
        });
    });
}

/**
 * Recherche de paroles (Mockup/Simple API)
 */
export async function findLyrics(song) {
    try {
        // Utilisation d'une API publique simple pour les paroles
        const url = `https://lyrist.vercel.app/api/${encodeURIComponent(song)}`;
        const { data } = await axios.get(url);
        if (data && data.lyrics) return { lyrics: data.lyrics, artist: data.artist, title: data.title, image: data.image };
        throw new Error('Paroles introuvables');
    } catch (e) {
        return null;
    }
}
