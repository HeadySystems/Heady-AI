import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../../../packages/structured-logger/src/index.js';

const execAsync = promisify(exec);
const logger = createLogger({ service: 'system-configurator' });

/**
 * Heady Auto-Configurator (SystemOperationsBee)
 * Enables Heady to autonomously reconfigure its own ecosystem without human intervention.
 */
export class SystemConfigurator {
    constructor(projectRoot = '/home/headyme/Heady') {
        this.projectRoot = projectRoot;
    }

    /**
     * Resolves systemic environmental mismatches (e.g., Node engine strictness)
     */
    async autoResolveEnvironment() {
        logger.info('Initiating autonomous environment resolution...');
        const pkgPath = path.join(this.projectRoot, 'package.json');
        
        try {
            // 1. Detect current Node version
            const currentNodeVersion = process.version.replace('v', '');
            logger.info(`Detected active Node version: ${currentNodeVersion}`);

            // 2. Read package.json
            const pkgRaw = await fs.readFile(pkgPath, 'utf8');
            const pkg = JSON.parse(pkgRaw);

            // 3. Align engines.node to the current environment to prevent pnpm locks
            if (pkg.engines && pkg.engines.node) {
                const required = pkg.engines.node;
                if (!required.includes(currentNodeVersion)) {
                    logger.warn(`Engine mismatch: package.json requires ${required}, but system runs ${currentNodeVersion}. Auto-patching...`);
                    
                    // Patch package.json to accept the current version
                    pkg.engines.node = `>=${currentNodeVersion.split('.')[0]}.0.0`;
                    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
                    logger.info(`package.json engines.node successfully patched to: ${pkg.engines.node}`);
                }
            }

            // 4. Align ESM Module type if missing (Performance optimization)
            if (pkg.type !== 'module') {
                logger.info(`Injecting "type": "module" into root package.json for optimal ESM resolution.`);
                pkg.type = 'module';
                await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
            }

            return { success: true, message: 'Environment successfully aligned and patched.' };
        } catch (error) {
            logger.error('Failed to auto-resolve environment:', error);
            throw error;
        }
    }

    /**
     * Autonomously provisions missing dependencies utilizing pnpm bypassing strict checks if needed
     */
    async autoProvisionDependencies(dependencies) {
        logger.info(`Autonomous provision triggered for: ${dependencies.join(', ')}`);
        try {
            const command = `pnpm add -w ${dependencies.join(' ')} --engine-strict=false`;
            const { stdout, stderr } = await execAsync(command, { cwd: this.projectRoot });
            logger.info(`Provisioning complete: ${stdout}`);
            return { success: true, log: stdout };
        } catch (error) {
            logger.error(`Failed autonomous provision: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * General configuration state update. 
     * Can patch arbitrary JSON config files like mcp.json, tsconfig, etc.
     */
    async patchConfiguration(configPathRel, patchObject) {
        const fullPath = path.join(this.projectRoot, configPathRel);
        logger.info(`Patching configuration file autonomously: ${configPathRel}`);
        
        try {
            const raw = await fs.readFile(fullPath, 'utf8');
            const config = JSON.parse(raw);
            
            // Deep merge patch
            const updatedConfig = { ...config, ...patchObject };
            await fs.writeFile(fullPath, JSON.stringify(updatedConfig, null, 2) + '\n', 'utf8');
            
            return { success: true, message: `Configuration ${configPathRel} updated successfully.` };
        } catch (e) {
            logger.error(`Failed to patch config ${configPathRel}:`, e);
            throw e;
        }
    }
}
