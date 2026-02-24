const fs = require('fs');
const https = require('https');
const path = require('path');

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '8b1fa38f282c691423c6399247d53323';
const token = process.env.CLOUDFLARE_API_TOKEN || 'VGNo4jwin3V6eFO0HpGGYUyn2iWFM6JpkPfdIqUa';
const indexName = 'heady-memory-idx';

async function seed() {
    console.log("Seeding Cloudflare Vectorize from local shards...");
    let allVectors = [];

    // Read all 5 shards
    for (let i = 0; i < 5; i++) {
        const p = path.join(__dirname, `../data/vector-shards/shard-${i}.json`);
        if (fs.existsSync(p)) {
            const data = JSON.parse(fs.readFileSync(p, 'utf8'));
            allVectors = allVectors.concat(data);
        }
    }

    // Also read legacy vector-memory.json if exists
    const legacyPath = path.join(__dirname, '../data/vector-memory.json');
    if (fs.existsSync(legacyPath)) {
        const data = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
        if (Array.isArray(data)) allVectors = allVectors.concat(data);
        else if (data.vectors) allVectors = allVectors.concat(data.vectors);
    }

    // Deduplicate by ID
    const unique = new Map();
    allVectors.forEach(v => {
        if (v && v.id && v.embedding && Array.isArray(v.embedding) && v.embedding.length === 384) {
            unique.set(v.id, {
                id: v.id,
                values: v.embedding,
                metadata: v.metadata || {}
            });
        }
    });

    const formatted = Array.from(unique.values());
    console.log(`Found ${formatted.length} valid 384-dimensional vectors for migration.`);

    if (formatted.length === 0) {
        console.log("No 384d vectors found. Seeding complete.");
        return;
    }

    const ndjson = formatted.map(v => JSON.stringify(v)).join('\n');

    const req = https.request(`https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}/insert`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-ndjson'
        }
    }, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            console.log("Vectorize Insert Result:", body);
        });
    });

    req.on('error', console.error);
    req.write(ndjson);
    req.end();
}

seed();
