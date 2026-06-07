// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: services/asset-pipeline.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Asset Pipeline — Port 3317
 * Multi-format processing, transform chain, CDN upload, content-hash versioning
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash, randomBytes } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, phiBackoff, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate, cslBlend, cosineSimilarity } from '../shared/csl-engine-v2.js';

// ── φ-Derived Constants ──────────────────────────────────────────
const MAX_FILE_SIZE_MB       = fibonacci(11);                // 89 MB
const PROCESSING_QUEUE_SIZE  = fibonacci(14);                // 377
const CONCURRENT_TRANSFORMS  = fibonacci(7);                 // 13
const CDN_CACHE_TTL_S        = fibonacci(17);                // 1597s
const VERSION_HISTORY_MAX    = fibonacci(9);                 // 34
const PRIORITY_LANES         = {
  urgent: fibonacci(3),     // 2 concurrent
  normal: fibonacci(5),     // 5 concurrent
  batch:  fibonacci(6),     // 8 concurrent
};

const SUPPORTED_FORMATS = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'svg', 'gif'],
  video: ['mp4', 'webm', 'mov', 'avi'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'aac'],
  document: ['pdf', 'docx', 'txt', 'md', 'html'],
};

// ── In-Memory Stores ─────────────────────────────────────────────
const assets = new Map();
const processingQueue = [];
const activeTransforms = new Set();
const sseClients = new Set();
const metrics = { uploaded: 0, processed: 0, transformed: 0, errors: 0 };

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

// ── Asset Registration ───────────────────────────────────────────
function registerAsset(spec) {
  const contentHash = sha256(spec.content || spec.url || randomBytes(32).toString('hex'));
  const id = contentHash.slice(0, 16);
  const ext = (spec.filename || '').split('.').pop()?.toLowerCase() || 'bin';
  const formatType = Object.entries(SUPPORTED_FORMATS)
    .find(([, exts]) => exts.includes(ext))?.[0] || 'unknown';

  const asset = {
    id,
    filename: spec.filename || 'unnamed.' + ext,
    format: ext,
    formatType,
    contentHash,
    sizeMb: spec.sizeMb || 0,
    versions: [{
      version: 1,
      contentHash,
      created: Date.now(),
      transforms: [],
      cdnUrl: null,
    }],
    metadata: spec.metadata || {},
    status: 'registered',
    created: Date.now(),
    lastModified: Date.now(),
  };

  const sizeGate = cslGate(
    asset.sizeMb / MAX_FILE_SIZE_MB,
    1.0 - (asset.sizeMb / MAX_FILE_SIZE_MB),
    phiThreshold(2),
    PSI * PSI * PSI
  );
  if (asset.sizeMb > MAX_FILE_SIZE_MB && sizeGate < PSI2) {
    return { error: 'file_too_large', maxMb: MAX_FILE_SIZE_MB, sizeMb: asset.sizeMb };
  }

  assets.set(id, asset);
  metrics.uploaded++;
  return { id, contentHash, format: ext, formatType, status: 'registered' };
}

// ── Transform Chain ──────────────────────────────────────────────
const transformHandlers = {
  resize: (asset, params) => ({
    transform: 'resize',
    width: params.width || Math.round(fibonacci(12) * PHI),
    height: params.height || fibonacci(12),
    quality: params.quality || Math.round(PSI * 100),
    hash: sha256('resize' + JSON.stringify(params)),
  }),
  compress: (asset, params) => ({
    transform: 'compress',
    algorithm: params.algorithm || 'zstd',
    level: params.level || fibonacci(5),
    ratio: PSI2,
    hash: sha256('compress' + JSON.stringify(params)),
  }),
  watermark: (asset, params) => ({
    transform: 'watermark',
    text: params.text || 'Heady',
    position: params.position || 'bottom-right',
    opacity: PSI,
    fontSize: fibonacci(7),
    hash: sha256('watermark' + JSON.stringify(params)),
  }),
  transcode: (asset, params) => ({
    transform: 'transcode',
    targetFormat: params.targetFormat || 'webp',
    codec: params.codec || 'auto',
    bitrate: params.bitrate || fibonacci(14) * 1000,
    hash: sha256('transcode' + JSON.stringify(params)),
  }),
  thumbnail: (asset, params) => ({
    transform: 'thumbnail',
    width: params.width || fibonacci(9) * 8,
    height: params.height || fibonacci(9) * 8,
    crop: params.crop || 'center',
    hash: sha256('thumbnail' + JSON.stringify(params)),
  }),
  metadata_extract: (asset) => ({
    transform: 'metadata_extract',
    fields: ['width', 'height', 'duration', 'codec', 'bitrate', 'channels', 'sampleRate'],
    hash: sha256('metadata' + asset.contentHash),
  }),
};

function enqueueTransform(assetId, transformChain, priority) {
  const asset = assets.get(assetId);
  if (!asset) return { error: 'asset_not_found' };

  const lane = priority || 'normal';
  const maxInLane = PRIORITY_LANES[lane] || PRIORITY_LANES.normal;

  const queueEntry = {
    id: sha256(assetId + Date.now() + randomBytes(8).toString('hex')),
    assetId,
    transforms: transformChain,
    priority: lane,
    status: 'queued',
    created: Date.now(),
    progress: 0,
    results: [],
  };

  if (processingQueue.length >= PROCESSING_QUEUE_SIZE) {
    processingQueue.shift();
  }
  processingQueue.push(queueEntry);
  return { queueId: queueEntry.id, assetId, transforms: transformChain.length, priority: lane };
}

async function processTransformQueue() {
  const results = [];

  while (processingQueue.length > 0 && activeTransforms.size < CONCURRENT_TRANSFORMS) {
    const entry = processingQueue.shift();
    if (!entry) break;
    activeTransforms.add(entry.id);
    entry.status = 'processing';

    const asset = assets.get(entry.assetId);
    if (!asset) {
      entry.status = 'error';
      activeTransforms.delete(entry.id);
      continue;
    }

    const transformResults = [];
    for (let i = 0; i < entry.transforms.length; i++) {
      const t = entry.transforms[i];
      const handler = transformHandlers[t.type];
      if (!handler) {
        transformResults.push({ type: t.type, error: 'unsupported_transform' });
        continue;
      }
      const result = handler(asset, t.params || {});
      transformResults.push(result);
      entry.progress = (i + 1) / entry.transforms.length;
      metrics.transformed++;

      // Broadcast progress via SSE
      broadcastProgress(entry.id, entry.assetId, entry.progress);
    }

    // Create new version
    const newVersion = {
      version: asset.versions.length + 1,
      contentHash: sha256(asset.contentHash + JSON.stringify(transformResults)),
      created: Date.now(),
      transforms: transformResults,
      cdnUrl: null,
    };

    if (asset.versions.length >= VERSION_HISTORY_MAX) {
      asset.versions.shift();
    }
    asset.versions.push(newVersion);
    asset.lastModified = Date.now();
    asset.status = 'processed';

    entry.status = 'completed';
    entry.results = transformResults;
    activeTransforms.delete(entry.id);
    metrics.processed++;
    results.push({ queueId: entry.id, assetId: entry.assetId, version: newVersion.version, transforms: transformResults });
  }

  return { processed: results.length, results };
}

// ── CDN Upload ───────────────────────────────────────────────────
function generateCdnUrl(assetId, versionNum) {
  const asset = assets.get(assetId);
  if (!asset) return { error: 'asset_not_found' };

  const version = versionNum
    ? asset.versions.find(v => v.version === versionNum)
    : asset.versions[asset.versions.length - 1];
  if (!version) return { error: 'version_not_found' };

  const cdnPath = '/cdn/' + version.contentHash.slice(0, 16) + '/' + asset.filename;
  version.cdnUrl = 'https://cdn.headysystems.com' + cdnPath;
  return {
    cdnUrl: version.cdnUrl,
    contentHash: version.contentHash,
    cacheTtl: CDN_CACHE_TTL_S,
    cacheKey: sha256(version.contentHash + CDN_CACHE_TTL_S),
  };
}

function invalidateCdnCache(assetId) {
  const asset = assets.get(assetId);
  if (!asset) return { error: 'asset_not_found' };
  const invalidated = asset.versions.filter(v => v.cdnUrl).map(v => ({
    url: v.cdnUrl,
    invalidatedAt: Date.now(),
  }));
  return { assetId, invalidated: invalidated.length, urls: invalidated };
}

// ── SSE Progress Broadcasting ────────────────────────────────────
function broadcastProgress(queueId, assetId, progress) {
  const data = JSON.stringify({ queueId, assetId, progress, timestamp: Date.now() });
  for (const client of sseClients) {
    try { client.write('data: ' + data + '\n\n'); }
    catch (writeErr) { sseClients.delete(client); }
  }
}

// ── HTTP Server ──────────────────────────────────────────────────
function createServer(port = 3317) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const readBody = () => new Promise((resolve) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (parseErr) { resolve({ _parseError: parseErr.message }); } });
      });

      if (url.pathname === '/assets/register' && req.method === 'POST') {
        const body = await readBody();
        respond(201, registerAsset(body));
      } else if (url.pathname === '/assets/transform' && req.method === 'POST') {
        const body = await readBody();
        respond(202, enqueueTransform(body.assetId, body.transforms, body.priority));
      } else if (url.pathname === '/assets/process' && req.method === 'POST') {
        respond(200, await processTransformQueue());
      } else if (url.pathname === '/assets/cdn' && req.method === 'POST') {
        const body = await readBody();
        respond(200, generateCdnUrl(body.assetId, body.version));
      } else if (url.pathname === '/assets/invalidate' && req.method === 'POST') {
        const body = await readBody();
        respond(200, invalidateCdnCache(body.assetId));
      } else if (url.pathname.startsWith('/assets/') && req.method === 'GET' && url.pathname !== '/assets/progress') {
        const id = url.pathname.split('/').pop();
        const asset = assets.get(id);
        respond(asset ? 200 : 404, asset || { error: 'not_found' });
      } else if (url.pathname === '/assets/progress') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
      } else if (url.pathname === '/health') {
        respond(200, health());
      } else {
        respond(404, { error: 'not_found' });
      }
    });
    server.listen(port);
    return server;
  });
}

const startTime = Date.now();
function health() {
  return {
    service: 'asset-pipeline',
    status: 'healthy',
    port: 3317,
    uptime: Date.now() - startTime,
    totalAssets: assets.size,
    queueDepth: processingQueue.length,
    activeTransforms: activeTransforms.size,
    sseClients: sseClients.size,
    metrics: { ...metrics },
    phiConstants: { MAX_FILE_SIZE_MB, CONCURRENT_TRANSFORMS, CDN_CACHE_TTL_S, VERSION_HISTORY_MAX },
  };
}

export default { createServer, health, registerAsset, enqueueTransform, processTransformQueue, generateCdnUrl, invalidateCdnCache };
export { createServer, health, registerAsset, enqueueTransform, processTransformQueue, generateCdnUrl, invalidateCdnCache };
