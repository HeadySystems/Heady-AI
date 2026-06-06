// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DNS Verification v1.0.0                                ║
// ║  Checks and retrieves Cloudflare DNS records for Heady domains ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';
const logger = pino();

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;

if (!token || !zoneId) {
  logger.error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID environment variable');
  process.exit(1);
}

async function checkDNS() {
  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Cloudflare API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    logger.info({ records: data.result }, 'DNS records retrieved successfully');
  } catch (error) {
    logger.error({ err: error.message }, 'Failed to check DNS records');
    process.exit(1);
  }
}

checkDNS();
