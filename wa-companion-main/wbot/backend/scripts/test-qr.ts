
import { connectWhatsApp } from '../src/services/whatsapp.service';
import { logger } from '../src/config/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
    try {
        const userId = 'test-local-user';
        logger.info(`Starting local QR test for user ${userId}`);

        const result = await connectWhatsApp(userId);

        logger.info('connectWhatsApp called successfully');
        logger.info(`Session ID: ${result.sessionId}`);
        logger.info('Please scan the QR code above in your terminal.');

        // Keep alive to allow scanning
        setInterval(() => { }, 1000);
    } catch (error) {
        logger.error('Error in test script:', error);
        // Log full error
        console.error(error);
        process.exit(1);
    }
}

main();
