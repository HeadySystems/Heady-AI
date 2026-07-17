const fetch = require('node-fetch');
const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = "d71262d0faa509f890fd5fea413c39bc";

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
