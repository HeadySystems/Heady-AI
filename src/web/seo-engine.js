/**
 * seo-engine.js — Comprehensive SEO Engine for Heady Platform
 *
 * JSON-LD structured data, sitemap.xml, robots.txt, Open Graph,
 * Twitter Cards, canonical URLs, and meta tag generation.
 * All sizing via Fibonacci, all thresholds φ-derived.
 *
 * Eric Haywood — HeadySystems
 * License: PROPRIETARY
 */

import { PHI, PSI, phiThreshold, fibSequence } from '../shared/phi-math.js';

// ── φ-Derived Constants ──────────────────────────────────
const MAX_TITLE_LEN    = 55;           // fib(10)
const MAX_DESC_LEN     = 233;          // fib(13)
const MAX_SITEMAP_URLS = 6765;         // fib(20)
const CACHE_SIZE       = 377;          // fib(14)
const SITEMAP_PRIORITY_DECAY = PSI;    // ≈ 0.618 per depth level

// ── Heady Domain Registry ────────────────────────────────
const HEADY_DOMAINS = [
  { domain: 'headyme.com',            role: 'Command center',                 priority: 1.0 },
  { domain: 'headysystems.com',       role: 'Core architecture engine',       priority: PSI + PSI * PSI },   // ≈ 1.0
  { domain: 'heady-ai.com',           role: 'Intelligence routing hub',       priority: PSI + PSI * PSI },
  { domain: 'headyos.com',            role: 'Operating system interface',     priority: PSI },               // ≈ 0.618
  { domain: 'headyconnection.org',    role: 'Nonprofit and community',        priority: PSI },
  { domain: 'headyconnection.com',    role: 'Community (commercial)',         priority: PSI * PSI },         // ≈ 0.382
  { domain: 'headyex.com',            role: 'Exchange platform',              priority: PSI * PSI },
  { domain: 'headyfinance.com',       role: 'Financial services',             priority: PSI * PSI },
  { domain: 'admin.headysystems.com', role: 'Admin panel',                    priority: 0.0 },              // noindex
];

// ── JSON-LD Generator ────────────────────────────────────
export function generateJsonLd(options = {}) {
  const {
    type = 'WebApplication',
    name = 'Heady',
    description = 'Sovereign AI Platform — Alive Software Architecture',
    url = 'https://headyme.com',
    author = 'Eric Haywood',
    organization = 'HeadySystems',
    orgUrl = 'https://headysystems.com',
    logo = 'https://headyme.com/logo.png',
    datePublished,
    dateModified,
    extra = {},
  } = options;

  const ld = {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description: description.slice(0, MAX_DESC_LEN),
    url,
    author: {
      '@type': 'Person',
      name: author,
    },
    publisher: {
      '@type': 'Organization',
      name: organization,
      url: orgUrl,
      logo: {
        '@type': 'ImageObject',
        url: logo,
      },
    },
    ...(datePublished && { datePublished }),
    ...(dateModified && { dateModified }),
    ...extra,
  };

  return `<script type="application/ld+json">${JSON.stringify(ld, null, 2)}</script>`;
}

// ── Open Graph & Twitter Card Meta ──────────────────────
export function generateMetaTags(options = {}) {
  const {
    title = 'Heady — Sovereign AI Platform',
    description = 'Alive Software Architecture by Eric Haywood',
    url = 'https://headyme.com',
    image = 'https://headyme.com/og-image.png',
    type = 'website',
    siteName = 'Heady',
    twitterHandle = '@HeadySystems',
    locale = 'en_US',
    canonical,
    noindex = false,
    extra = [],
  } = options;

  const tags = [];
  
  // Basic meta
  tags.push(`<meta charset="utf-8">`);
  tags.push(`<meta name="viewport" content="width=device-width, initial-scale=1">`);
  tags.push(`<title>${title.slice(0, MAX_TITLE_LEN)}</title>`);
  tags.push(`<meta name="description" content="${description.slice(0, MAX_DESC_LEN)}">`);
  
  if (noindex) {
    tags.push(`<meta name="robots" content="noindex, nofollow">`);
  }
  
  if (canonical || url) {
    tags.push(`<link rel="canonical" href="${canonical || url}">`);
  }
  
  // Open Graph
  tags.push(`<meta property="og:type" content="${type}">`);
  tags.push(`<meta property="og:title" content="${title.slice(0, MAX_TITLE_LEN)}">`);
  tags.push(`<meta property="og:description" content="${description.slice(0, MAX_DESC_LEN)}">`);
  tags.push(`<meta property="og:url" content="${url}">`);
  tags.push(`<meta property="og:image" content="${image}">`);
  tags.push(`<meta property="og:site_name" content="${siteName}">`);
  tags.push(`<meta property="og:locale" content="${locale}">`);
  
  // Twitter Card
  tags.push(`<meta name="twitter:card" content="summary_large_image">`);
  tags.push(`<meta name="twitter:title" content="${title.slice(0, MAX_TITLE_LEN)}">`);
  tags.push(`<meta name="twitter:description" content="${description.slice(0, MAX_DESC_LEN)}">`);
  tags.push(`<meta name="twitter:image" content="${image}">`);
  tags.push(`<meta name="twitter:site" content="${twitterHandle}">`);
  
  // Extra tags
  for (const tag of extra) {
    tags.push(tag);
  }
  
  return tags.join('\n    ');
}

// ── Sitemap Generator ────────────────────────────────────
export function generateSitemap(pages = [], options = {}) {
  const {
    baseUrl = 'https://headyme.com',
    defaultChangefreq = 'weekly',
    defaultPriority = PSI,   // ≈ 0.618
  } = options;

  const urls = pages.slice(0, MAX_SITEMAP_URLS).map(page => {
    const loc = page.url.startsWith('http') ? page.url : `${baseUrl}${page.url}`;
    const priority = page.priority ?? Math.max(0.1, defaultPriority * Math.pow(SITEMAP_PRIORITY_DECAY, page.depth || 0));
    const lastmod = page.lastmod || new Date().toISOString().split('T')[0];
    const changefreq = page.changefreq || defaultChangefreq;
    
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(2)}</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

// ── Robots.txt Generator ─────────────────────────────────
export function generateRobotsTxt(options = {}) {
  const {
    sitemapUrl = 'https://headyme.com/sitemap.xml',
    disallowPaths = ['/api/', '/admin/', '/internal/', '/_next/'],
    allowPaths = ['/'],
    crawlDelay = 1,
    additionalRules = [],
  } = options;

  const lines = [
    'User-agent: *',
    ...allowPaths.map(p => `Allow: ${p}`),
    ...disallowPaths.map(p => `Disallow: ${p}`),
    `Crawl-delay: ${crawlDelay}`,
    '',
    ...additionalRules,
    '',
    `Sitemap: ${sitemapUrl}`,
  ];

  return lines.join('\n');
}

// ── Heady Multi-Domain SEO Config ────────────────────────
export function getHeadyDomainSEO(domain) {
  const found = HEADY_DOMAINS.find(d => d.domain === domain);
  if (!found) return null;
  
  return {
    domain: found.domain,
    role: found.role,
    priority: found.priority,
    noindex: found.priority === 0.0,
    canonical: `https://${found.domain}`,
    jsonLd: generateJsonLd({
      name: `Heady — ${found.role}`,
      url: `https://${found.domain}`,
    }),
  };
}

/**
 * Generate full SEO head section for a Heady page
 */
export function generateSEOHead(pageOptions = {}) {
  const meta = generateMetaTags(pageOptions);
  const jsonLd = generateJsonLd(pageOptions);
  
  return `${meta}
    ${jsonLd}`;
}

export { HEADY_DOMAINS };
export default { generateJsonLd, generateMetaTags, generateSitemap, generateRobotsTxt, getHeadyDomainSEO, generateSEOHead };
