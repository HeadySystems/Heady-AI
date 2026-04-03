'use strict';
// Stub site renderer
module.exports = {
  renderSite: async (siteConfig, context) => ({ html: '', status: 200 }),
  getSiteConfig: (domain) => null,
};
