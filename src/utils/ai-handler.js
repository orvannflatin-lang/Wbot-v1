import axios from 'axios';

// Clé API de l'utilisateur
const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyC3l7RK2E5MByjUcV22MQ1hmr91wRWqiCc';

/**
 * Pose une question à Gemini (Via API Google Directe - "Bare Metal")
 * Plus de SDK, plus d'API tierces down. Juste HTTP standard.
 * @param {string} prompt - La question
 * @returns {Promise<string>} - La réponse de l'IA
 */
export async function askGemini(prompt) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data && response.data.candidates && response.data.candidates[0].content) {
            return response.data.candidates[0].content.parts[0].text;
        }

        throw new Error('Réponse Gemini vide ou malformée');

    } catch (error) {
        console.error('❌ Gemini Direct Error:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            apiKey: API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NON DÉFINIE'
        });

        // Messages d'erreur plus clairs
        if (!API_KEY) {
            return "⚠️ Clé API Gemini non configurée. Définissez GEMINI_API_KEY dans vos variables d'environnement.";
        }

        if (error.response?.status === 401) {
            return "⚠️ Clé API Gemini invalide ou expirée. Vérifiez votre GEMINI_API_KEY.";
        }

        if (error.response?.status === 429) {
            return "⚠️ Limite de requêtes dépassée. Réessayez plus tard.";
        }

        if (error.response?.status === 400) {
            return `⚠️ Requête invalide: ${error.response?.data?.error?.message || error.message}`;
        }

        return `⚠️ Erreur API Gemini (${error.response?.status || error.code || 'INCONNUE'}): ${error.response?.data?.error?.message || error.message}`;
    }
}

/**
 * Analyse une image avec Gemini 1.5 Flash (API Directe Multimodale)
 */
export async function analyzeImageWithGemini(imageBuffer, prompt = "Décris cette image.") {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

        // Conversion Buffer -> Base64 propre
        const base64Image = imageBuffer.toString('base64');

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: base64Image
                        }
                    }
                ]
            }]
        };

        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data && response.data.candidates && response.data.candidates[0].content) {
            return response.data.candidates[0].content.parts[0].text;
        }

        throw new Error('Réponse Vision vide');

    } catch (error) {
        console.error('❌ Gemini Vision Direct Error:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            apiKey: API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NON DÉFINIE'
        });

        // Messages d'erreur plus clairs
        if (!API_KEY) {
            return "⚠️ Clé API Gemini non configurée. Définissez GEMINI_API_KEY dans vos variables d'environnement.";
        }

        if (error.response?.status === 401) {
            return "⚠️ Clé API Gemini invalide ou expirée. Vérifiez votre GEMINI_API_KEY.";
        }

        if (error.response?.status === 429) {
            return "⚠️ Limite de requêtes dépassée. Réessayez plus tard.";
        }

        if (error.response?.status === 400) {
            return `⚠️ Requête invalide: ${error.response?.data?.error?.message || error.message}`;
        }

        return `⚠️ Erreur de vision (${error.response?.status || error.code || 'INCONNUE'}): ${error.response?.data?.error?.message || error.message}`;
    }
}
