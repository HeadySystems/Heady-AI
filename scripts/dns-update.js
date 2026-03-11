const pino = require('pino');
const logger = pino();
// const fetch = require('node-fetch'); // Not required in Node.js >= 18
const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const target = "heady-manager-609590223909.us-central1.run.app";

async function updateDNS(id, name) {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${id}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: 'CNAME',
            name: name,
            content: target,
            proxied: true,
            ttl: 1
        })
    });
    const data = await res.json();
    console.log(`Updated ${name}:`, data.success ? 'SUCCESS' : 'FAILED', JSON.stringify(data.errors));
}

async function run() {
    await updateDNS("e7dd1223ad17290d8848a4d9a13af3f1", "headysystems.com");
    await updateDNS("2febb63db75ee466361fd46ab1bb0c1e", "www.headysystems.com");
}

run();
