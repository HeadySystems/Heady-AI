const v8 = require('v8');
const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode'); // Requires npm install bytenode
const obfuscator = require('javascript-obfuscator'); // Requires npm install javascript-obfuscator

v8.setFlagsFromString('--no-lazy');

const TARGET_DIR = path.join(__dirname, '../dist/proxy');
const SOURCE_DIR = path.join(__dirname, '../src');

console.log("🚀 [Heady Compiler] Initiating Tier-1 Quantum Obfuscation & Bytecode Compilation...");

if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function compileToBytecode(sourceFile, targetFile) {
    try {
        const rawCode = fs.readFileSync(sourceFile, 'utf8');

        // Step 1: Aggressive AST Obfuscation
        const obfuscatedResult = obfuscator.obfuscate(rawCode, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 1,
            numbersToExpressions: true,
            simplify: true,
            stringArrayShuffle: true,
            splitStrings: true,
            stringArrayThreshold: 1,
            target: 'node'
        });

        const tempJsPath = targetFile.replace('.jsc', '.temp.js');
        fs.writeFileSync(tempJsPath, obfuscatedResult.getObfuscatedCode());

        // Step 2: V8 Isolate Bytecode Compilation
        bytenode.compileFile({
            filename: tempJsPath,
            output: targetFile
        });

        // Cleanup temp obfuscated js so only binary remains
        fs.unlinkSync(tempJsPath);

        console.log(`✅ Compiled Binary: ${path.basename(targetFile)} (V8 Bytecode)`);
    } catch (error) {
        console.error(`❌ Build Error on ${sourceFile}:`, error.message);
    }
}

function processDirectory(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    const items = fs.readdirSync(src);
    for (let item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);

        if (fs.statSync(srcPath).isDirectory()) {
            processDirectory(srcPath, destPath);
        } else if (item.endsWith('.js')) {
            const binaryDest = destPath.replace('.js', '.jsc');
            compileToBytecode(srcPath, binaryDest);
        }
    }
}

// Kick off the build pipeline
processDirectory(SOURCE_DIR, TARGET_DIR);
console.log("🔥 [Heady Compiler] Build pipeline complete. All sources converted to proprietary V8 binaries.");
