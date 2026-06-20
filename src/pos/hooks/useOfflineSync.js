import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { offlineStore } from '../../lib/offlineStore'

export default function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refreshCount = useCallback(async () => {
    const q = await offlineStore.getQueue()
    setPendingCount(q.length)
  }, [])

  const syncNow = useCallback(async () => {
    const queue = await offlineStore.getQueue()
    if (!queue.length) return
    setSyncing(true)
    for (const entry of queue) {
      try {
        if (entry.op === 'insert') {
          const { error } = await supabase.from(entry.table).insert(entry.payload)
          // Duplicate key errors mean it was already synced — treat as success
          if (error && !error.message?.includes('duplicate')) throw error
        } else if (entry.op === 'update') {
          let q = supabase.from(entry.table).update(entry.payload)
          if (entry.match) Object.entries(entry.match).forEach(([k, v]) => { q = q.eq(k, v) })
          const { error } = await q
          if (error) throw error
        }
        await offlineStore.dequeue(entry.id)
        setPendingCount(prev => Math.max(0, prev - 1))
      } catch(e) {
        console.error('[sync] failed for entry', entry.table, entry.op, e)
        // Continue — don't block the rest of the queue for one failure
      }
    }
    setSyncing(false)
    // Final count reconciliation
    refreshCount()
  }, [refreshCount])

  useEffect(() => {
    // Read initial pending count
    refreshCount()

    // Auto-sync when internet returns
    function onOnline() { syncNow() }
    window.addEventListener('online', onOnline)

    // Update badge whenever dbWrite queues something
    window.addEventListener('offline-queue-updated', refreshCount)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline-queue-updated', refreshCount)
    }
  }, [syncNow, refreshCount])

  return { pendingCount, syncing, syncNow }
}
