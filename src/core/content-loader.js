/**
 * © 2026 HeadySystems Inc. — Dynamic Content Loader
 *
 * Loads rich domain-specific content from JSON files in content/domains/.
 * Falls back to hardcoded content-sections.js for domains with hand-crafted copy.
 * Transforms JSON content into the renderer format expected by dynamic-site-server.js
 */

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '../../content/domains');

/**
 * Load and transform JSON content for a domain into renderer-compatible format.
 * Reads hero.json, features.json, pricing.json, meta.json, tools.json, etc.
 * Returns { about, deepDive, technology, faq, pricing } or null.
 */
function loadDomainContent(domain) {
  const domainDir = path.join(CONTENT_DIR, domain);
  if (!fs.existsSync(domainDir)) return null;

  const content = {};

  // Load hero.json → about section
  const hero = loadJSON(domainDir, 'hero.json');
  if (hero) {
    content.about = {
      title: hero.headline || `About ${domain}`,
      paragraphs: [
        hero.subheadline,
        hero.body,
      ].filter(Boolean),
    };
  }

  // Load features.json → deepDive section
  const features = loadJSON(domainDir, 'features.json');
  if (features && features.features) {
    content.deepDive = {
      title: features.sectionTitle || 'Key Features',
      items: features.features.slice(0, 6).map(f => ({
        icon: f.icon || '⚡',
        title: f.title,
        desc: f.description ? f.description.substring(0, 280) + (f.description.length > 280 ? '...' : '') : '',
      })),
    };
  }

  // Load tools.json → additional deepDive items (if features aren't enough)
  const tools = loadJSON(domainDir, 'tools.json');
  if (tools && tools.tools && !content.deepDive) {
    content.deepDive = {
      title: tools.sectionTitle || 'Our Tools',
      items: tools.tools.slice(0, 6).map(t => ({
        icon: t.icon || '🔧',
        title: t.name || t.title,
        desc: t.description ? t.description.substring(0, 280) + (t.description.length > 280 ? '...' : '') : t.tagline || '',
      })),
    };
  }

  // Load pricing.json → technology section (repurposed as pricing overview)
  const pricing = loadJSON(domainDir, 'pricing.json');
  if (pricing && pricing.tiers) {
    content.technology = {
      title: pricing.sectionTitle || 'Pricing',
      stack: pricing.tiers.map(t => ({
        label: t.name,
        value: t.priceLabel || (t.price === 0 ? 'Free' : `$${t.price}/mo`),
      })),
    };
  }

  // Load site.json for supplementary data
  const site = loadJSON(domainDir, 'site.json');

  // Build FAQ from various sources
  const faqItems = [];

  // Check for explicit FAQ in any file
  if (pricing && pricing.tiers) {
    faqItems.push({
      q: `What does ${site ? site.brand : domain} cost?`,
      a: pricing.sectionSubtitle || `${site ? site.brand : domain} offers multiple pricing tiers to fit your needs.`,
    });
  }
  if (hero) {
    faqItems.push({
      q: `What is ${site ? site.brand : domain}?`,
      a: hero.subheadline || hero.body || `${site ? site.brand : domain} is part of the Heady AI ecosystem.`,
    });
  }
  if (features && features.features && features.features.length > 0) {
    faqItems.push({
      q: `What features does ${site ? site.brand : domain} offer?`,
      a: features.sectionSubtitle || features.features.map(f => f.title).join(', ') + '.',
    });
  }
  if (site && site.audiences) {
    faqItems.push({
      q: `Who is ${site ? site.brand : domain} for?`,
      a: `${site.brand} is designed for ${site.audiences.join(', ')}. ${site.purpose || ''}`,
    });
  }

  if (faqItems.length > 0) {
    content.faq = faqItems;
  }

  // Only return if we have meaningful content
  return (content.about || content.deepDive) ? content : null;
}

function loadJSON(dir, filename) {
  try {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

module.exports = { loadDomainContent, loadJSON };
