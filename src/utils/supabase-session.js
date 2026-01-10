import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 🔒 VARIABLES HARDCODÉES (Sécurisées)
// Ces clés permettent au bot de se connecter directement sans config utilisateur
const SUPABASE_URL = 'https://kgwrlutwqnfhqizeftgb.supabase.co';
const SUPABASE_KEY = 'sb_secret_bXf8z9qjjPi8YwqTlAHmkA_cQhJqEB7';
const TABLE_NAME = 'wbot_sessions';

// Initialisation Client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false
    }
});

/**
 * Génère un ID de session sécurisé et complexe
 * Format: WBOT~[UUID_V4] (Ex: WBOT~550e8400-e29b-41d4-a716-446655440000)
 */
function generateSecureSessionId() {
    return `WBOT~${crypto.randomUUID()}`;
}

/**
 * Upload auth_info folder to Supabase SQL Table
 * @param {string} authFolder 
 * @param {string} phoneNumber (Optionnel) Pour loger à qui appartient la session
 * @returns {Promise<string>} Secure Session ID
 */
export async function uploadSessionToSupabase(authFolder, phoneNumber = null) {
    try {
        console.log('🔄 Préparation de la sauvegarde SQL...');
        const sessionData = {};

        // Lire tous les fichiers du dossier auth
        if (fs.existsSync(authFolder)) {
            const files = fs.readdirSync(authFolder);
            for (const file of files) {
                const filePath = path.join(authFolder, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    sessionData[file] = content;
                } catch (readErr) {
                    console.warn(`⚠️ Ignore fichier non-texte: ${file}`);
                }
            }
        } else {
            throw new Error(`Dossier introuvable: ${authFolder}`);
        }

        // Vérifier qu'on a des données
        if (Object.keys(sessionData).length === 0) {
            throw new Error('Aucune donnée de session à sauvegarder (Dossier vide ?)');
        }

        // Générer ID Unique
        const sessionId = generateSecureSessionId();

        // Insertion en base de données
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .insert([
                {
                    session_id: sessionId,
                    session_data: sessionData,
                    owner_phone: phoneNumber,
                    updated_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) {
            console.error('❌ SQL Insert Error:', error);
            throw new Error('Erreur sauvegarde base de données: ' + error.message);
        }

        console.log(`✅ Session sauvegardée en base ! ID: ${sessionId} (Phone: ${phoneNumber || 'N/A'})`);
        return sessionId;

    } catch (error) {
        console.error('❌ Erreur Upload Supabase:', error);
        throw error;
    }
}

/**
 * Retrieve session from Supabase SQL Table by Secure ID
 * @param {string} sessionId (Format: WBOT~...)
 * @param {string} targetFolder 
 */
export async function restoreSessionFromSupabase(sessionId, targetFolder) {
    try {
        if (!sessionId) throw new Error('Session ID manquant');

        // Nettoyage ID (au cas où espace/newline)
        const cleanId = sessionId.trim();

        console.log(`🔄 Récupération session SQL: ${cleanId}...`);

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('session_data')
            .eq('session_id', cleanId)
            .single();

        if (error || !data) {
            console.error('❌ Erreur SQL Select:', error);
            throw new Error('Session introuvable ou invalide');
        }

        const sessionFiles = data.session_data;

        // Préparer dossier cible
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        // Restaurer les fichiers
        let restoredCount = 0;
        for (const [filename, content] of Object.entries(sessionFiles)) {
            const filePath = path.join(targetFolder, filename);
            fs.writeFileSync(filePath, content, 'utf-8');
            restoredCount++;
        }

        console.log(`✅ Session restaurée avec succès (${restoredCount} fichiers).`);
        return true;

    } catch (error) {
        console.error('❌ Erreur Restauration Supabase:', error.message);
        throw error;
    }
}
