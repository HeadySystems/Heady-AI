#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { engine: computeEngine } = require('../../mcp-servers/heady-compute-mcp-server');
const { getLog } = require('../../src/kernel');

const logger = getLog('knowledge-crawler');

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'artifacts', 'scratch']);
const IGNORE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.zip', '.tar', '.gz']);
const CHUNK_SIZE = 500; // characters

let filesProcessed = 0;
let chunksEmbedded = 0;

async function crawlAndEmbed(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!IGNORE_DIRS.has(file)) {
          await crawlAndEmbed(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (!IGNORE_EXTS.has(ext)) {
          await processFile(fullPath);
        }
      }
    } catch (err) {
      logger.error(`Error processing ${fullPath}: ${err.message}`);
    }
  }
}

async function processFile(filePath) {
  filesProcessed++;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Very simple naive chunking for simulation purposes
    const chunks = [];
    for (let i = 0; i < content.length; i += CHUNK_SIZE) {
      chunks.push(content.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.trim().length < 20) continue; // Skip very small empty chunks
      
      const chunkId = `${filePath}#${i}`;
      
      // 1. Semantic Embedding
      const embedRes = await computeEngine.embed(chunk);
      
      // 2. 3D Vector Upsert
      await computeEngine.vectorUpsert(chunkId, embedRes.vector, {
        filePath,
        chunkIndex: i,
        length: chunk.length,
        timestamp: new Date().toISOString()
      });
      
      chunksEmbedded++;
      if (chunksEmbedded % 100 === 0) {
        logger.info(`Crawler embedded ${chunksEmbedded} chunks...`);
      }
    }
  } catch (err) {
    // Ignore non-text encoding issues
  }
}

async function run() {
  logger.info('Initializing Autonomous Knowledge Crawler...');
  const repoRoot = path.join(__dirname, '../../');
  
  await crawlAndEmbed(repoRoot);
  
  logger.info(`Crawler complete. Processed ${filesProcessed} files and embedded ${chunksEmbedded} geometric vectors.`);
}

run().catch(err => {
  logger.error('Crawler failed: ' + err.message);
  process.exit(1);
});
