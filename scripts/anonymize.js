const fs = require('fs');
const path = require('path');

const targetStr = 'HeadyMe';
const replacementStr = 'HeadyMe';

const ignoreDirs = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'artifacts', 'scratch']);
const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.zip', '.tar', '.gz']);

let filesProcessed = 0;
let filesModified = 0;
let occurrencesReplaced = 0;

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!ignoreDirs.has(file)) {
          walkDir(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (!binaryExts.has(ext)) {
          processFile(fullPath);
        }
      }
    } catch (err) {
      console.error(`Error processing ${fullPath}:`, err.message);
    }
  }
}

function processFile(filePath) {
  filesProcessed++;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(targetStr)) {
      const regex = new RegExp(targetStr, 'g');
      const matches = content.match(regex);
      if (matches) {
        const newContent = content.replace(regex, replacementStr);
        fs.writeFileSync(filePath, newContent, 'utf8');
        filesModified++;
        occurrencesReplaced += matches.length;
        console.log(`Modified: ${filePath} (${matches.length} occurrences)`);
      }
    }
  } catch (err) {
    // Might fail on some weirdly encoded files that aren't strictly text
  }
}

console.log(`Starting replacement process...`);
console.log(`Target: "${targetStr}"`);
console.log(`Replacement: "${replacementStr}"\n`);

walkDir('/home/headyme/Heady');

console.log(`\nReplacement complete!`);
console.log(`Files scanned: ${filesProcessed}`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total occurrences replaced: ${occurrencesReplaced}`);
