import { useState, useEffect } from 'react'

export default function OfflineBar({ pendingCount = 0, syncing = false }) {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [showBack, setShowBack] = useState(false)
  const [backTimer, setBackTimer] = useState(null)

  useEffect(() => {
    function goOffline() { setOffline(true); setShowBack(false); clearTimeout(backTimer) }
    function goOnline()  {
      setOffline(false); setShowBack(true)
      const t = setTimeout(() => setShowBack(false), 4000)
      setBackTimer(t)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
      clearTimeout(backTimer)
    }
  }, [])

  // Keep "back online" banner visible while still syncing
  const visible = offline || showBack || syncing

  if (!visible) return null

  let bg      = offline ? '#DE350B' : '#00875A'
  let icon    = offline ? '📵' : syncing ? '🔄' : '✅'
  let message = offline
    ? `Offline${pendingCount > 0 ? ` — ${pendingCount} pesanan tertunda, akan sync otomatis` : ' — Mode offline aktif'}`
    : syncing
      ? `Menyinkronkan ${pendingCount > 0 ? pendingCount + ' item' : ''}...`
      : 'Sinkronisasi selesai ✓'

  if (syncing) bg = '#F59E0B'

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: bg, color: '#fff', fontSize: 12, fontWeight: 700,
      textAlign: 'center', padding: '6px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      transition: 'background 0.3s',
    }}>
      <span>{icon}</span> {message}
    </div>
  )
}
