import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { createLogger } from '../../../packages/structured-logger/src/index.js';

const logger = createLogger({ service: 'secret-manager-backend' });

export class SecretManagerBackend {
    constructor(projectId = process.env.GOOGLE_CLOUD_PROJECT || 'heady-systems-core') {
        this.projectId = projectId;
        this.useGCP = process.env.USE_GCP_SECRET_MANAGER === 'true';
        if (this.useGCP) {
            // Only instantiate the client if explicitly opted-in to GCP
            this.client = new SecretManagerServiceClient();
        } else {
            this.client = null;
        }
        this.cache = new Map();
    }

    /**
     * Retrieves a secret from native process.env or GCP Secret Manager
     * Uses HeadyKey schema natively
     */
    async getSecret(secretName, version = 'latest') {
        // Return from memory cache if available for <10ms zero-latency execution
        if (this.cache.has(secretName)) {
            return this.cache.get(secretName);
        }

        // Native Priority: If GCP is disabled, or we have the variable locally, use it immediately
        if (!this.useGCP || process.env[secretName]) {
            if (process.env[secretName]) {
                logger.info(`Vault unlock requested natively for HeadyKey: ${secretName}`);
                this.cache.set(secretName, process.env[secretName]);
                return process.env[secretName];
            }
            if (!this.useGCP) {
                throw new Error(`Critical Vault Error: Cannot access HeadyKey ${secretName} in native environment`);
            }
        }

        const name = `projects/${this.projectId}/secrets/${secretName}/versions/${version}`;
        logger.info(`Vault unlock requested for HeadyKey: ${secretName} via GCP Secret Manager`);

        try {
            const [versionInfo] = await this.client.accessSecretVersion({ name });
            const payload = versionInfo.payload.data.toString('utf8');
            
            // Store in fast memory cache
            this.cache.set(secretName, payload);
            logger.info(`Successfully retrieved and cached HeadyKey: ${secretName}`);
            
            return payload;
        } catch (error) {
            logger.error(`Failed to retrieve secret ${secretName} from HeadyVault GCP:`, error);
            
            throw new Error(`Critical Vault Error: Cannot access HeadyKey ${secretName}`);
        }
    }

    /**
     * Clear the cache for a specific secret to force rotation/reload
     */
    invalidateCache(secretName) {
        this.cache.delete(secretName);
        logger.info(`Invalidated cache for HeadyKey: ${secretName}`);
    }
}
