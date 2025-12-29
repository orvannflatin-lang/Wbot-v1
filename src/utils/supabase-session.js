
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configuration Supabase fournie par l'utilisateur
const SUPABASE_URL = 'https://kgwrlutwqnfhqizeftgb.supabase.co';
const SUPABASE_KEY = 'sb_secret_bXf8z9qjjPi8YwqTlAHmkA_cQhJqEB7'; // Clé Secrète

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Upload auth_info folder to Supabase and return Short ID
 * @param {string} authFolder 
 * @returns {Promise<string>} Short Session ID (WBOT~...)
 */
export async function uploadSessionToSupabase(authFolder) {
    try {
        const sessionData = {};
        const files = fs.readdirSync(authFolder);

        for (const file of files) {
            const filePath = path.join(authFolder, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            sessionData[file] = content;
        }

        const jsonString = JSON.stringify(sessionData);

        // Générer un ID court aléatoire (8 chars)
        const shortId = 'WBOT~' + Math.random().toString(36).substring(2, 10).toUpperCase();

        // Sauvegarder dans la table 'whatsapp_sessions'
        // Note: La table doit exister. On essaie d'insérer.
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .insert([
                { session_id: shortId, session_data: jsonString }
            ])
            .select();

        if (error) throw error;

        return shortId;
    } catch (error) {
        console.error('Erreur Upload Supabase:', error);
        throw error;
    }
}

/**
 * Retrieve session from Supabase by Short ID
 * @param {string} shortId 
 * @param {string} targetFolder 
 */
export async function restoreSessionFromSupabase(shortId, targetFolder) {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('session_data')
            .eq('session_id', shortId)
            .single();

        if (error || !data) throw new Error('Session introuvable sur Supabase');

        const sessionData = JSON.parse(data.session_data);

        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        for (const [filename, content] of Object.entries(sessionData)) {
            const filePath = path.join(targetFolder, filename);
            fs.writeFileSync(filePath, content, 'utf-8');
        }

        return true;
    } catch (error) {
        console.error('Erreur Restauration Supabase:', error);
        throw error;
    }
}
