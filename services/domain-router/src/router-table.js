const routeTable = {
  'headysystems.com': { site: 'HeadySystems', service: 'api-gateway' },
  'www.headysystems.com': { site: 'HeadySystems', service: 'api-gateway' },
  'api.headysystems.com': { site: 'HeadySystems', service: 'api-gateway' },
};

export function resolveHost(hostname) {
  const entry = routeTable[hostname];
  if (!entry) {
    return { site: null, service: null };
  }
  return { site: entry.site, service: entry.service };
}
