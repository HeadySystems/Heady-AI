// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: scripts/dns-update.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DNS Provisioning v1.0.0                                ║
// ║  Updates Cloudflare DNS records to route to Heady infrastructure║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';
const logger = pino();

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const target = process.env.DNS_TARGET_URL || 'heady-manager-1003436179562.us-central1.run.app';

if (!token || !zoneId) {
  logger.error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID environment variable');
  process.exit(1);
}

async function updateDNS(id, name) {
  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${id}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'CNAME',
        name: name,
        content: target,
        proxied: true,
        ttl: 1,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Cloudflare API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    if (data.success) {
      logger.info({ name, target }, 'DNS record updated successfully');
    } else {
      logger.error({ name, errors: data.errors }, 'Failed to update DNS record');
    }
  } catch (error) {
    logger.error({ name, err: error.message }, 'Failed to update DNS record due to exception');
  }
}

async function run() {
  await updateDNS('e7dd1223ad17290d8848a4d9a13af3f1', 'headysystems.com');
  await updateDNS('2febb63db75ee466361fd46ab1bb0c1e', 'www.headysystems.com');
}

run();
