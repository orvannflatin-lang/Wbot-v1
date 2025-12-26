import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_FILE = path.join(__dirname, '../../lib/store_msg.json');
const MAX_STORE_SIZE_MB = 5; // Limite de 5MB pour le fichier

// Créer le dossier lib s'il n'existe pas
const libDir = path.dirname(STORE_FILE);
if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
}

/**
 * Vérifie et réinitialise le store si trop volumineux
 */
function checkAndResetStore() {
    try {
        if (!fs.existsSync(STORE_FILE)) return;
        
        const stats = fs.statSync(STORE_FILE);
        const sizeMB = stats.size / (1024 * 1024);
        
        if (sizeMB > MAX_STORE_SIZE_MB) {
            console.warn(`⚠️ Store trop volumineux (${sizeMB.toFixed(2)}MB > ${MAX_STORE_SIZE_MB}MB). Réinitialisation...`);
            fs.writeFileSync(STORE_FILE, JSON.stringify({}, null, 2));
        }
    } catch (error) {
        console.error('Erreur vérification store:', error);
    }
}

/**
 * Récupère un message depuis le store
 * @param {string} messageId - ID du message
 * @returns {Object|null} - Message stocké ou null
 */
export function getMessage(messageId) {
    try {
        if (!fs.existsSync(STORE_FILE)) return null;
        
        const store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
        return store[messageId] || null;
    } catch (error) {
        console.error('Erreur récupération message:', error);
        return null;
    }
}

/**
 * Ajoute un message au store
 * @param {string} messageId - ID du message
 * @param {Object} message - Message complet à stocker
 */
export function addMessage(messageId, message) {
    try {
        let store = {};
        if (fs.existsSync(STORE_FILE)) {
            store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
        }
        
        // Stocker uniquement les messages récents (limite de 10000 messages)
        const keys = Object.keys(store);
        if (keys.length > 10000) {
            // Supprimer les 1000 plus anciens
            const sortedKeys = keys.sort();
            const toDelete = sortedKeys.slice(0, 1000);
            toDelete.forEach(key => delete store[key]);
        }
        
        store[messageId] = message;
        fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
        
        // Vérifier la taille périodiquement
        if (keys.length % 100 === 0) {
            checkAndResetStore();
        }
    } catch (error) {
        console.error('Erreur ajout message au store:', error);
    }
}

/**
 * Supprime un message du store
 * @param {string} messageId - ID du message
 */
export function removeMessage(messageId) {
    try {
        if (!fs.existsSync(STORE_FILE)) return;
        
        const store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
        delete store[messageId];
        fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
    } catch (error) {
        console.error('Erreur suppression message:', error);
    }
}

/**
 * Nettoie le store (supprime les messages anciens)
 */
export function cleanStore() {
    try {
        if (!fs.existsSync(STORE_FILE)) return;
        
        checkAndResetStore();
        console.log('✅ Store nettoyé');
    } catch (error) {
        console.error('Erreur nettoyage store:', error);
    }
}

export default {
    getMessage,
    addMessage,
    removeMessage,
    cleanStore
};



