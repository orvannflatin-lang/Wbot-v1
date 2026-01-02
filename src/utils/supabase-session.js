import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configuration Supabase fournie par l'utilisateur
const SUPABASE_URL = 'https://kgwrlutwqnfhqizeftgb.supabase.co';
const SUPABASE_KEY = 'sb_secret_bXf8z9qjjPi8YwqTlAHmkA_cQhJqEB7';
const BUCKET_NAME = 'wbot_sessions'; // Bucket created successfully via debug script

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Upload auth_info folder to Supabase Storage and return Short ID
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

        // Générer un ID court aléatoire (8 chars) sans caractères spéciaux problématiques
        const shortId = 'WBOT_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        const fileName = `${shortId}.json`;

        // Sauvegarder dans le BUCKET 'wbot_sessions'
        // Utilisation de .upload avec upsert: true
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, jsonString, {
                contentType: 'application/json',
                upsert: true
            });

        if (error) {
            console.error('Bucket Upload Error:', error);
            throw new Error('Failed to upload to Supabase Storage: ' + error.message);
        }

        return shortId;
    } catch (error) {
        console.error('Erreur Upload Supabase:', error);
        throw error;
    }
}

/**
 * Retrieve session from Supabase Storage by Short ID
 * @param {string} shortId 
 * @param {string} targetFolder 
 */
export async function restoreSessionFromSupabase(shortId, targetFolder) {
    try {
        const fileName = `${shortId}.json`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(fileName);

        if (error || !data) throw new Error('Session introuvable sur Supabase Storage');

        const textContent = await data.text();
        const sessionData = JSON.parse(textContent);

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
