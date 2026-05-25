// PawonLoka Service Worker - static assets only, NO navigation cache
const CACHE = 'pawonloka-v1'
const STATIC = ['/logo.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // NEVER cache navigation requests - let Cloudflare handle routing
  if (e.request.mode === 'navigate') return
  // NEVER cache Supabase API requests
  if (e.request.url.includes('supabase.co')) return
  // Cache-first for static assets only
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  )
})
