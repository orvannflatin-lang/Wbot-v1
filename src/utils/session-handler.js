import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Encode auth_info folder to Base64 SESSION_ID (Compressed)
 * @param {string} authFolder - Path to auth_info folder
 * @returns {string} Base64 encoded session ID
 */
export function encodeSession(authFolder) {
    try {
        const sessionData = {};

        // Read all files in auth_info folder
        const files = fs.readdirSync(authFolder);

        for (const file of files) {
            const filePath = path.join(authFolder, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            sessionData[file] = content;
        }

        // Convert to JSON -> Buffer -> GZIP -> Base64
        const jsonString = JSON.stringify(sessionData);
        const buffer = Buffer.from(jsonString, 'utf-8');
        const compressed = zlib.gzipSync(buffer);

        return `WBOT_${compressed.toString('base64')}`;
    } catch (error) {
        console.error('Error encoding session:', error);
        throw error;
    }
}

/**
 * Decode SESSION_ID and restore auth_info folder
 * @param {string} sessionId - Base64 encoded session ID
 * @param {string} targetFolder - Where to restore the session
 */
export function decodeSession(sessionId, targetFolder) {
    try {
        // Remove WBOT_ prefix if present
        const base64Data = sessionId.startsWith('WBOT_')
            ? sessionId.substring(5)
            : sessionId;

        // Decode from Base64 -> GZIP -> JSON
        const compressedBuffer = Buffer.from(base64Data, 'base64');
        let sessionData;

        try {
            const decompressed = zlib.gunzipSync(compressedBuffer);
            sessionData = JSON.parse(decompressed.toString('utf-8'));
        } catch (e) {
            // Fallback for legacy uncompressed sessions
            const jsonString = compressedBuffer.toString('utf-8');
            sessionData = JSON.parse(jsonString);
        }

        // Create target folder if it doesn't exist
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        // Write all files
        for (const [filename, content] of Object.entries(sessionData)) {
            const filePath = path.join(targetFolder, filename);
            fs.writeFileSync(filePath, content, 'utf-8');
        }

        console.log('✅ Session restored successfully');
        return true;
    } catch (error) {
        console.error('Error decoding session:', error);
        throw error;
    }
}

/**
 * Generate random session ID for new connections
 * @returns {string} Random session ID
 */
export function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `WBOT_SESSION_${timestamp}_${randomStr}`.toUpperCase();
}

/**
 * Check if a session ID is valid
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean}
 */
export function isValidSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') return false;

    // Must start with WBOT_
    if (!sessionId.startsWith('WBOT_')) return false;

    // Try to decode (lite check)
    try {
        const base64Data = sessionId.substring(5);
        Buffer.from(base64Data, 'base64');
        return true;
    } catch {
        return false;
    }
}

export default {
    encodeSession,
    decodeSession,
    generateSessionId,
    isValidSessionId
};
