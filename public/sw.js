// Minimal service worker — its presence + a fetch handler make the app installable.
//
// SECURITY: Cache Storage is scoped to the ORIGIN, not to the session. It
// survives sign-out, it is shared by every user of the browser profile, and it
// ignores the `Cache-Control: no-store` Next.js sets on dynamic authenticated
// renders. A worker that cached "every same-origin GET except /api" therefore
// stored /admin, /people, /meetings and /profile — full HTML documents and RSC
// payloads — and served them back offline to whoever picked the device up next,
// with no session check of any kind.
//
// So nothing user-specific is cached, ever. Only immutable build assets and
// icons go in (see `isCacheableAsset`); documents and RSC payloads are network
// only, and offline navigation falls back to the static shell below, which is
// built from a constant in this file and contains no user data.
const CACHE = 'logpup-v2'

// No colours declared: `color-scheme` lets the browser supply its own light and
// dark defaults, so this stays readable in both without hard-coding hex values
// the design tokens aren't reachable from here.
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline · LogPup</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-content: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  h1 { font-size: 1.125rem; margin: 0; }
  p { margin: 0; opacity: 0.7; font-size: 0.875rem; }
</style>
</head>
<body>
  <h1>You're offline</h1>
  <p>LogPup needs a connection. Reconnect and try again.</p>
</body>
</html>`

function offlineDocument() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// Strict allowlist. Everything here is build-immutable or a static icon —
// nothing that varies per user or per session. `/_next/image` is deliberately
// absent (it proxies user-uploaded avatars), as are all HTML and RSC responses.
function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/pwa-icon' ||
    url.pathname === '/apple-icon' ||
    /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?)$/.test(url.pathname)
  )
}

// Belt and braces behind the allowlist: never store a response the server
// explicitly marked as uncacheable or user-private.
function isStorable(response) {
  const cacheControl = (response.headers.get('Cache-Control') || '').toLowerCase()
  return !cacheControl.includes('no-store') && !cacheControl.includes('private')
}

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Bumping CACHE to logpup-v2 is what purges it: installs still holding a
      // logpup-v1 cache full of authenticated documents drop it here, on the
      // first activation after this worker ships.
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return

  // Documents: network only. An authenticated render must never reach a
  // session-less, origin-wide cache, so offline gets the static shell rather
  // than the last page this browser profile happened to see.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => offlineDocument()))
    return
  }

  // Anything not on the allowlist — RSC payloads above all — is left to the
  // network untouched, so it is neither read from nor written to the cache.
  if (!isCacheableAsset(url)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic' && isStorable(response)) {
          const copy = response.clone()
          caches
            .open(CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => {})
        }
        return response
      })
    }),
  )
})

// Explicit wipe, posted by the client when it lands on the signed-out page.
// Same-origin only — a worker must not take instructions from another origin.
self.addEventListener('message', (event) => {
  if (event.origin && event.origin !== self.location.origin) return
  if (event.data?.type !== 'logpup-clear-cache') return
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))))
})
