/**
 * Heady™ SalesBee Execution Script
 * Triggers the SalesBee to generate outreach drafts from 990 data.
 * 
 * © 2026 Heady™Systems Inc.
 */

const SalesBee = require('../src/swarm/templates/sales-bee');
const fs = require('fs');
const path = require('path');

// Mock 990 parser if it doesn't exist to ensure we get drafts
const parserPath = path.join(process.cwd(), 'src/services/990-parser.js');
if (!fs.existsSync(parserPath)) {
    console.log('📝 [SalesBee] Creating mock 990-parser for initial draft generation...');
    const mockParser = `
    module.exports = {
        scanForOpportunities: async () => [
            { organizationName: 'Foundation for Future AI', focus: 'AI Safety', estimatedGrantSize: 250000 },
            { organizationName: 'The Tech Equity Fund', focus: 'AI Access', estimatedGrantSize: 500000 },
            { organizationName: 'Green Intelligence Initiative', focus: 'Sustainable AI', estimatedGrantSize: 150000 }
        ]
    };`;
    fs.mkdirSync(path.dirname(parserPath), { recursive: true });
    fs.writeFileSync(parserPath, mockParser);
}

async function run() {
    const bee = new SalesBee({ id: 'sales-bee-01' });
    const result = await bee.execute('Generate initial enterprise outreach drafts');
    
    console.log('\n🚀 [SalesBee] Outreach Drafts Generated:\n');
    console.log(JSON.stringify(result, null, 2));

    // Save to drafts directory (ensure it exists)
    const draftsDir = path.join(process.cwd(), 'data', 'sales-bee-drafts');
    if (!fs.existsSync(draftsDir)) {
        fs.mkdirSync(draftsDir, { recursive: true });
    }
    const artifactPath = path.join(draftsDir, `drafts-${Date.now()}.json`);
    fs.writeFileSync(artifactPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ [SalesBee] Drafts saved to: ${artifactPath}`);
}

run().catch(console.error);
