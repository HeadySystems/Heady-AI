/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ Dropzone Watcher Service v1.0.0                          ║
 * ║  Monitors ./dropzone and ingests files into Heady Vector Space   ║
 * ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const fs = require('fs');
const path = require('path');
const { queueForEmbed } = require('./continuous-embedder');
const logger = require('../utils/logger').child('dropzone-watcher');

class DropzoneWatcher {
    constructor(projectRoot) {
        this.projectRoot = projectRoot || process.cwd();
        this.dropzonePath = path.join(this.projectRoot, 'dropzone');
        this.processedPath = path.join(this.dropzonePath, '.processed');
        this.isWatching = false;
        this.watcher = null;
        // Debounce map for file writes
        this.processingFiles = new Set();
    }

    start() {
        if (this.isWatching) return;
        
        try {
            // Ensure directories exist
            if (!fs.existsSync(this.dropzonePath)) {
                fs.mkdirSync(this.dropzonePath, { recursive: true });
            }
            if (!fs.existsSync(this.processedPath)) {
                fs.mkdirSync(this.processedPath, { recursive: true });
            }

            this.watcher = fs.watch(this.dropzonePath, (eventType, filename) => {
                if (!filename || filename === '.processed') return;
                
                const filePath = path.join(this.dropzonePath, filename);
                
                // Ignore directories and hidden files
                if (filename.startsWith('.') || !fs.existsSync(filePath)) return;
                
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) return;

                if (eventType === 'rename' || eventType === 'change') {
                    this.handleNewFile(filePath, filename);
                }
            });

            this.isWatching = true;
            logger.info({ dropzonePath: this.dropzonePath }, 'Dropzone watcher started');
            
            // Initial scan of existing files
            this.scanExistingFiles();
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to start dropzone watcher');
        }
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.isWatching = false;
        logger.info('Dropzone watcher stopped');
    }

    scanExistingFiles() {
        try {
            const files = fs.readdirSync(this.dropzonePath);
            for (const file of files) {
                if (file === '.processed' || file.startsWith('.')) continue;
                const filePath = path.join(this.dropzonePath, file);
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    this.handleNewFile(filePath, file);
                }
            }
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to scan existing dropzone files');
        }
    }

    async handleNewFile(filePath, filename) {
        if (this.processingFiles.has(filePath)) return;
        this.processingFiles.add(filePath);

        try {
            // Wait slightly for file writes to finish
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!fs.existsSync(filePath)) {
                this.processingFiles.delete(filePath);
                return;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            
            // 1. Ingest to continuous embedder
            queueForEmbed(content, {
                domain: 'dropzone',
                filename: filename,
                source: 'dropzone-watcher'
            });

            logger.info({ filename }, 'Ingested dropped file into continuous embedder');

            // 2. Emit global event to trigger the bee and massive workflow payload
            if (global.eventBus) {
                global.eventBus.emit('dropzone:file:received', {
                    filename,
                    content,
                    filePath
                });
            }

            // 3. Move to .processed
            const destPath = path.join(this.processedPath, `${Date.now()}_${filename}`);
            fs.renameSync(filePath, destPath);

        } catch (error) {
            logger.error({ filename, error: error.message }, 'Error processing dropzone file');
        } finally {
            this.processingFiles.delete(filePath);
        }
    }
}

let activeWatcher = null;

function startDropzoneWatcher(projectRoot) {
    if (!activeWatcher) {
        // Load the reaction bee so it binds to the event bus
        require('../bees/dropzone-reaction-bee');
        
        activeWatcher = new DropzoneWatcher(projectRoot);
        activeWatcher.start();
    }
    return activeWatcher;
}

function stopDropzoneWatcher() {
    if (activeWatcher) {
        activeWatcher.stop();
        activeWatcher = null;
    }
}

module.exports = {
    startDropzoneWatcher,
    stopDropzoneWatcher,
    DropzoneWatcher
};
