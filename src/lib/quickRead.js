import { offlineStore } from './offlineStore'

function _timeout(ms) {
  return new Promise((_, rej) => setTimeout(() => rej(new Error('qr-timeout')), ms))
}

/**
 * Cache-first Supabase read with hard timeout.
 * - If cache exists: return it immediately, refresh in background.
 * - If no cache: try Supabase with `ms` timeout, fall back to cache on failure.
 *
 * Usage:
 *   const rows = await qr(supabase.from('tables').select('*'), { cache:'tables' })
 *   const rows = await qr(supabase.from('orders').select('*').eq('status','Open'), { ms:3000 })
 */
export async function qr(query, { cache, ms = 5000 } = {}) {
  if (cache) {
    const cached = await offlineStore.getCache(cache)
    if (cached !== null) {
      // Background refresh — never blocks UI
      Promise.race([query, _timeout(ms)])
        .then(({ data }) => { if (data) offlineStore.setCache(cache, data) })
        .catch(() => {})
      return cached
    }
  }
  // No cache — attempt with hard timeout
  try {
    const { data, error } = await Promise.race([query, _timeout(ms)])
    if (error) throw error
    if (cache && data) offlineStore.setCache(cache, data)
    return data
  } catch {
    return cache ? (await offlineStore.getCache(cache)) : null
  }
}
