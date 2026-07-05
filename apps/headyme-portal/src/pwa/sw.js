// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal Service Worker — Cloud-Connected Thin Client       ║
// ║  Authored here (skeleton-guard keeps public/ script-free) and     ║
// ║  emitted verbatim to dist/sw.js by the heady-sw-stamp plugin in   ║
// ║  vite.config.mjs, which also injects the version stamp below      ║
// ║  from facts.yaml product.version.                                 ║
// ║  Strategy:                                                        ║
// ║    /api/**        → untouched network passthrough (SSE-safe:      ║
// ║                     the SW never calls respondWith, so streaming  ║
// ║                     fetch/EventSource bodies bypass it entirely)  ║
// ║    /assets/**     → cache-first (Vite content-hashed, immutable;  ║
// ║                     populated at runtime on first fetch)          ║
// ║    navigations    → network-first, offline fallback to the        ║
// ║                     precached app shell (/index.html)             ║
// ║    shell files    → versioned precache, cache-first               ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

const STAMP = "{{HEADY_SW_VERSION}}";
const SW_VERSION = STAMP.startsWith("{{") ? "dev" : STAMP;
const CACHE_PREFIX = "headyme-portal-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${SW_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${SW_VERSION}`;

// App shell — everything needed to boot offline. Hashed bundles are NOT
// listed here (their names change every build); they are cached at runtime
// by the /assets/ cache-first handler below.
const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // cache: "reload" bypasses the HTTP cache so the precached shell is
      // always the freshly deployed copy, never a stale intermediary hit.
      cache.addAll(SHELL_URLS.map((url) => new Request(url, { cache: "reload" })))
    )
  );
  // NO skipWaiting here — the update flow is user-consented: the page shows
  // a "new version ready" toast and posts HEADY_SKIP_WAITING on approval.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        console.info(JSON.stringify({ evt: "heady.sw.activate", version: SW_VERSION }));
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "HEADY_SKIP_WAITING") {
    console.info(JSON.stringify({ evt: "heady.sw.skip_waiting", version: SW_VERSION }));
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GET is ever cacheable; mutations always ride the network untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (fonts CDN, Firebase auth, telemetry) — never intercepted.
  if (url.origin !== self.location.origin) return;

  // /api/** — NETWORK ONLY, zero interception. Returning without calling
  // respondWith leaves the browser's native request path fully intact,
  // which is mandatory for the portal's SSE surfaces
  // (fetch ReadableStream /api/lens/stream, EventSource /api/advisor/stream).
  if (url.pathname.startsWith("/api/")) return;

  // Belt-and-braces: any event-stream negotiation outside /api/ also passes.
  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/event-stream")) return;

  // Vite content-hashed bundles — immutable, so cache-first is always safe.
  // Resolution model: no build manifest needed; each hashed file is cached
  // on its first successful fetch, and the whole cache generation rotates
  // (activate cleanup) when a new SW version deploys.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }

  // Navigations — network-first so a live deploy is picked up immediately,
  // falling back to the precached shell for the offline case.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/index.html", { cacheName: SHELL_CACHE }).then(
          (shell) =>
            shell ||
            new Response("HeadyMe Portal is offline and the shell is not cached yet.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
        )
      )
    );
    return;
  }

  // Remaining same-origin static GETs (shell files, icons): cache-first
  // against the versioned precache, network fallback.
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
