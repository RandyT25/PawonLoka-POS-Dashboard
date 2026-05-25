const CACHE_VERSION = 'pawonloka-v3'
const DATA_CACHE = 'pawonloka-data-v3'

// These get cached on install
const PRECACHE = [
  '/',
  '/backoffice',
  '/staff',
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

  // JS/CSS/images - cache first, then network
  if (url.pathname.match(/\.(js|css|png|jpg|ico|svg|woff2?)$/)) {
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
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/')))
    )
    return
  }
})

// Listen for messages to cache data
self.addEventListener('message', e => {
  if (e.data?.type === 'CACHE_DATA') {
    caches.open(DATA_CACHE).then(c => {
      c.put(e.data.url, new Response(JSON.stringify(e.data.data), {
        headers: { 'Content-Type': 'application/json' }
      }))
    })
  }
})
