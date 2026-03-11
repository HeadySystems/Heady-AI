const pino = require('pino');
const logger = pino();
// const fetch = require('node-fetch'); // Not required in Node.js >= 18
const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;

async function checkDNS() {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

checkDNS();
