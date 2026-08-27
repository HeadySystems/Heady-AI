import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { vault } from '../src/services/secure-key-vault.js';
import pino from 'pino';

// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Vault Ingestion Script v1.0.0                            ║
// ║  Migrates raw credentials from dropzone to encrypted vector space║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = pino({ name: 'VaultIngest', level: 'info' });

const DROPZONE_DIR = path.resolve(__dirname, '../dropzone');
const DOMAIN = 'gcloud';

async function ingestDropzone() {
    logger.info('Starting Vault Ingestion from Dropzone...');
    
    // Attempt unlock if needed, based on environment passphrase
    if (process.env.VAULT_PASSPHRASE) {
        await vault.unlock(process.env.VAULT_PASSPHRASE);
    } else {
        logger.warn('No VAULT_PASSPHRASE in environment. Expecting vault to be unlocked.');
    }

    if (!fs.existsSync(DROPZONE_DIR)) {
        logger.warn(`Dropzone directory not found at ${DROPZONE_DIR}`);
        process.exit(0);
    }

    const files = fs.readdirSync(DROPZONE_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
        logger.info('No raw JSON credentials found in dropzone.');
        process.exit(0);
    }

    for (const file of jsonFiles) {
        const filePath = path.join(DROPZONE_DIR, file);
        logger.info({ file }, 'Processing raw credential file...');
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Basic validation
            if (!content.includes('BEGIN PRIVATE KEY')) {
                logger.warn({ file }, 'File does not look like a private key. Skipping.');
                continue;
            }

            // Store in vault
            const credentialName = file.replace('.json', '');
            const result = await vault.store(credentialName, DOMAIN, content, {
                source: 'dropzone',
                ingestedAt: new Date().toISOString()
            });

            logger.info({ result }, `Successfully encrypted and stored credential.`);

            // Securely delete file using shred
            logger.info({ file }, 'Shredding original plaintext file...');
            execSync(`shred -u "${filePath}"`);
            logger.info({ file }, 'Plaintext file securely destroyed.');

        } catch (err) {
            logger.error({ err: err.message, file }, 'Failed to ingest credential');
        }
    }

    logger.info('Vault ingestion complete.');
}

ingestDropzone().catch(err => {
    logger.error({ err: err.message }, 'Fatal error during ingestion');
    process.exit(1);
});
