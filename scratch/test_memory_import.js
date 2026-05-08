const path = require('path');

async function test() {
    try {
        console.log('Attempting to import Vector Memory Store...');
        const storePath = path.resolve(__dirname, '../src/core/vector-memory/vector-store.js');
        const mod = await import('file://' + storePath);
        console.log('Import successful!');
        console.log('Export keys:', Object.keys(mod));
    } catch (e) {
        console.error('Import failed:');
        console.error(e);
    }
}

test();
