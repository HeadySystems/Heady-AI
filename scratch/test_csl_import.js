const path = require('path');

async function test() {
    try {
        console.log('Attempting to import CSL Engine...');
        const cslPath = path.resolve(__dirname, '../src/core/csl-engine/csl-engine.js');
        const mod = await import('file://' + cslPath);
        console.log('Import successful!');
        console.log('Export keys:', Object.keys(mod));
    } catch (e) {
        console.error('Import failed:');
        console.error(e);
    }
}

test();
