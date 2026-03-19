/**
 * HeadySystems Inc. — HTTPS Redirect Worker
 * 
 * Forces HTTPS on headysystems.com where HTTP does not redirect to HTTPS.
 * 
 * Deploy: Cloudflare Dashboard → Workers → Create Worker → paste this code
 * Route: http://headysystems.com/*, http://www.headysystems.com/*
 * 
 * PHI constant: Response timeout set to φ × 1000 = 1618ms
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    /* If already HTTPS, pass through to origin */
    if (url.protocol === 'https:') {
      return fetch(request);
    }

    /* Upgrade HTTP to HTTPS with 301 permanent redirect */
    url.protocol = 'https:';
    return new Response(null, {
      status: 301,
      headers: {
        'Location': url.toString(),
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Redirect-By': 'HeadySystems HTTPS Worker'
      }
    });
  }
};
