const DB_NAME    = 'pawonloka_offline'
const DB_VERSION = 1

let _db = null

function openDB() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = e => { _db = e.target.result; resolve(_db) }
    req.onerror   = () => reject(req.error)
  })
}

function tx(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode)
    const store = t.objectStore(storeName)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  }))
}

export const offlineStore = {
  // ── Cache (static data: products, categories, etc.) ────────────────────────

  setCache(key, data) {
    return tx('cache', 'readwrite', s => s.put({ key, data, ts: Date.now() }))
  },

  async getCache(key) {
    const row = await tx('cache', 'readonly', s => s.get(key))
    return row?.data ?? null
  },

  // ── Queue (pending writes) ──────────────────────────────────────────────────

  enqueue(entry) {
    return tx('queue', 'readwrite', s => s.add({ ...entry, ts: Date.now() }))
  },

  getQueue() {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction('queue', 'readonly')
      const req = t.objectStore('queue').getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror   = () => reject(req.error)
    }))
  },

  dequeue(id) {
    return tx('queue', 'readwrite', s => s.delete(id))
  },
}
