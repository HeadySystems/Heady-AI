// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Semantic Sync Gate v1.0.0                               ║
// ║  Computes Merkle-style folder hashes and extracts signatures.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');

const EXCLUDE_DIRS = ['node_modules', '.git', '.turbo', 'dist', '.data', 'artifacts', 'snapshots', 'tooling/data-consistency', 'docs/reports'];
const FILE_EXTS = ['.mjs', '.js', '.ts'];

// Compute SHA256 of string
function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

// Extract module signatures (classes, functions, imports, exports)
function extractSignatures(content) {
  const exports = [];
  const classes = [];
  const functions = [];

  // Simple regexes to extract patterns
  const exportRegex = /export\s+(?:default\s+)?(class|function|const|let|var|async\s+function)\s+(\w+)/g;
  const classRegex = /\bclass\s+(\w+)/g;
  const funcRegex = /\b(?:async\s+)?function\s+(\w+)\s*\(/g;

  let match;
  exportRegex.lastIndex = 0;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push({ type: match[1], name: match[2] });
  }

  classRegex.lastIndex = 0;
  while ((match = classRegex.exec(content)) !== null) {
    if (!classes.includes(match[1])) classes.push(match[1]);
  }

  funcRegex.lastIndex = 0;
  while ((match = funcRegex.exec(content)) !== null) {
    if (!functions.includes(match[1])) functions.push(match[1]);
  }

  return { exports, classes, functions };
}

// Recursive walking with Merkle tree calculation
function buildMerkleTree(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return null;
  }

  const children = {};
  const filesList = [];
  
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = relative(REPO_ROOT, abs).split(sep).join('/');
    
    if (EXCLUDE_DIRS.some(ex => rel === ex || rel.startsWith(`${ex}/`) || rel.split('/').includes(ex))) {
      continue;
    }

    if (entry.isDirectory()) {
      const subtree = buildMerkleTree(abs);
      if (subtree) {
        children[entry.name] = subtree;
      }
    } else if (entry.isFile() && FILE_EXTS.some(ext => entry.name.endsWith(ext))) {
      let content = '';
      try {
        content = readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      
      const fileHash = sha256(content);
      const signatures = extractSignatures(content);
      
      children[entry.name] = {
        type: 'file',
        hash: fileHash,
        relPath: rel,
        signatures
      };
      
      filesList.push(fileHash);
    }
  }

  const childEntries = Object.entries(children);
  if (childEntries.length === 0) return null;

  // Compute directory hash from combined hashes of children (sorted for determinism)
  childEntries.sort((a, b) => a[0].localeCompare(b[0]));
  const childHashesCombined = childEntries.map(([name, node]) => `${name}:${node.hash ?? sha256(JSON.stringify(node))}`).join('|');
  const dirHash = sha256(childHashesCombined);

  return {
    type: 'directory',
    hash: dirHash,
    children
  };
}

async function main() {
  console.log('HEADY™ Semantic Sync Gate starting...');
  const merkleTree = buildMerkleTree(REPO_ROOT);
  
  if (!merkleTree) {
    console.error('[SemanticGate] Failed to build Merkle tree.');
    process.exit(1);
  }

  // Flatten signatures for easy retrieval
  const flatSignatures = {};
  
  function flatten(node) {
    if (node.type === 'file') {
      flatSignatures[node.relPath] = {
        hash: node.hash,
        signatures: node.signatures
      };
    } else if (node.children) {
      for (const child of Object.values(node.children)) {
        flatten(child);
      }
    }
  }
  
  flatten(merkleTree);

  const ledgerDir = join(REPO_ROOT, '.data', 'task-ledger');
  if (!existsSync(ledgerDir)) {
    mkdirSync(ledgerDir, { recursive: true });
  }

  // Save the Merkle tree and flat signatures
  writeFileSync(join(ledgerDir, 'merkle-tree.json'), JSON.stringify(merkleTree, null, 2), 'utf-8');
  writeFileSync(join(ledgerDir, 'codebase-signatures.json'), JSON.stringify(flatSignatures, null, 2), 'utf-8');
  console.log('[SemanticGate] Wrote Merkle tree and signatures ledger.');

  // Build Markdown Report
  const reportDir = join(REPO_ROOT, 'docs', 'reports');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }
  
  const mdReport = [];
  mdReport.push('<!-- ⚠️ GENERATED REPORT — DO NOT EDIT DIRECTLY -->');
  mdReport.push('# HEADY™ Codebase Semantic & Signature Map');
  mdReport.push(`**Generated on:** ${new Date().toISOString()} · **Type:** Merkle Signature Scan`);
  mdReport.push('');
  mdReport.push('---');
  mdReport.push('');
  mdReport.push(`## 1. Merkle Tree Root Hash: \`${merkleTree.hash}\``);
  mdReport.push('');
  mdReport.push('## 2. Package Signatures Registry');
  mdReport.push('| Package File | Exports | Classes |');
  mdReport.push('|---|---|---|');
  
  for (const [file, info] of Object.entries(flatSignatures)) {
    const exportsStr = info.signatures.exports.length > 0 ? info.signatures.exports.map(e => `\`${e.name} (${e.type})\``).join('<br>') : '*None*';
    const classesStr = info.signatures.classes.length > 0 ? info.signatures.classes.map(c => `\`${c}\``).join(', ') : '*None*';
    mdReport.push(`| \`${file}\` | ${exportsStr} | ${classesStr} |`);
  }

  writeFileSync(join(reportDir, 'semantic-signature-map.md'), mdReport.join('\n'), 'utf-8');
  console.log('[SemanticGate] Wrote report to docs/reports/semantic-signature-map.md');
  console.log('HEADY™ Semantic Sync Gate finished.');
}

main().catch(err => {
  console.error('[SemanticGate] Error:', err);
  process.exit(1);
});
