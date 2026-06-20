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

// ── Eager full sync — downloads everything needed for offline use ─────────────
export async function offlineFullSync(supabase) {
  await Promise.allSettled([
    supabase.from('products').select('*').eq('active', true)
      .then(({data}) => data?.length && offlineStore.setCache('products', data)),
    supabase.from('categories').select('*').order('sort')
      .then(({data}) => data?.length && offlineStore.setCache('categories', data)),
    supabase.from('modifier_groups').select('*')
      .then(({data}) => data?.length && offlineStore.setCache('modifier_groups', data)),
    supabase.from('app_settings').select('*').eq('id','main').maybeSingle()
      .then(({data}) => data && offlineStore.setCache('app_settings', data)),
    supabase.from('discounts').select('*').eq('active', true)
      .then(({data}) => data && offlineStore.setCache('discounts', data)),
    supabase.from('bundles').select('*').eq('active', true)
      .then(({data}) => data && offlineStore.setCache('bundles', data)),
    supabase.from('tables').select('*').order('sort')
      .then(({data}) => data && offlineStore.setCache('tables', data)),
    supabase.from('sub_recipes').select('*').order('name')
      .then(({data}) => data && offlineStore.setCache('sub_recipes', data)),
    supabase.from('sub_recipe_ingredients').select('*')
      .then(({data}) => data && offlineStore.setCache('sub_recipe_ingredients', data)),
    supabase.from('ingredients').select('id,name,unit,stock,cost_per_unit,category,station,min_stock').order('name')
      .then(({data}) => data && offlineStore.setCache('ingredients', data)),
    supabase.from('staff').select('id,name,role,pin,color,active,permissions').eq('active', true).order('name')
      .then(({data}) => { if (data?.length) localStorage.setItem('pos_staff_cache', JSON.stringify(data)) }),
  ])
}
