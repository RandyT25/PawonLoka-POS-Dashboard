const CACHE_VERSION = 'pawonloka-v7'
const DATA_CACHE = 'pawonloka-data-v7'

// These get cached on install
const PRECACHE = [
  '/',
  '/backoffice',
  '/staff',
  '/owner',
  '/logo.png',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(c => {
      return Promise.allSettled(PRECACHE.map(url => c.add(url).catch(() => {})))
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_VERSION && k !== DATA_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Never intercept Supabase - always network
  if (url.hostname.includes('supabase.co')) return

  // Never intercept non-GET
  if (e.request.method !== 'GET') return

  // JS/CSS - network first so deploys always deliver fresh code
  if (url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() => caches.match(e.request))
    )
    return
  }

  // Images - cache first (rarely change)
  if (url.pathname.match(/\.(png|jpg|ico|svg|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_VERSION).then(c => c.put(e.request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Navigation (HTML pages) - network first, fall back to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_VERSION).then(c => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html') || caches.match('/')))
    )
    return
  }
})

// Listen for messages to cache data
self.addEventListener('message', e => {
  if (e.data?.type === 'CACHE_DATA') {
    e.waitUntil(
      caches.open(DATA_CACHE).then(c =>
        c.put(e.data.url, new Response(JSON.stringify(e.data.data), {
          headers: { 'Content-Type': 'application/json' }
        }))
      )
    )
  }
})
