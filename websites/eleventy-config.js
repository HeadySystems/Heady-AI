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
// ║  FILE: websites/eleventy-config.js                               ║
// ║  LAYER: root                                                     ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const path = require('path');

module.exports = function(eleventyConfig) {
  // ─── Passthrough Copy ──────────────────────────────────────────
  eleventyConfig.addPassthroughCopy('sites/*/assets');
  eleventyConfig.addPassthroughCopy('templates/css');

  // ─── Watch Targets ─────────────────────────────────────────────
  eleventyConfig.addWatchTarget('templates/');
  eleventyConfig.addWatchTarget('sites/');

  // ─── Filters ───────────────────────────────────────────────────
  eleventyConfig.addFilter('dateDisplay', (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  });

  eleventyConfig.addFilter('jsonStringify', (value) => {
    return JSON.stringify(value, null, 2);
  });

  eleventyConfig.addFilter('slugify', (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  });

  // ─── Shortcodes ────────────────────────────────────────────────
  eleventyConfig.addShortcode('year', () => `${new Date().getFullYear()}`);

  eleventyConfig.addShortcode('sacredCard', (title, description) => {
    return `<div class="sacred-card"><h3>${title}</h3><p>${description}</p></div>`;
  });

  eleventyConfig.addShortcode('apiEndpoint', (method, path, description) => {
    return `<div class="api-endpoint"><code>${method}</code> <code>${path}</code><span>${description}</span></div>`;
  });

  // ─── Collections ───────────────────────────────────────────────
  eleventyConfig.addCollection('allPages', (collectionApi) => {
    return collectionApi.getAll().sort((a, b) => {
      return (a.data.order || 999) - (b.data.order || 999);
    });
  });

  // ─── Layout Aliases ────────────────────────────────────────────
  eleventyConfig.addLayoutAlias('base', 'base.njk');
  eleventyConfig.addLayoutAlias('page', 'page.njk');

  // ─── Directory Config ──────────────────────────────────────────
  return {
    dir: {
      input: 'sites',
      output: '_dist',
      includes: '../templates/includes',
      layouts: '../templates/layouts',
      data: '../templates/data',
    },
    templateFormats: ['njk', 'html', 'md'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
};
