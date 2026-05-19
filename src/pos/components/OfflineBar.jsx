import { useState, useEffect } from 'react'

export default function OfflineBar() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    function goOffline() { setOffline(true); setShowBack(false) }
    function goOnline()  { setOffline(false); setShowBack(true); setTimeout(() => setShowBack(false), 3000) }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline) }
  }, [])

  if (!offline && !showBack) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: offline ? '#DE350B' : '#00875A',
      color: '#fff', fontSize: 12, fontWeight: 700,
      textAlign: 'center', padding: '6px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      transition: 'background 0.3s',
    }}>
      {offline
        ? <><span>📵</span> You're offline — POS still works, orders will sync when reconnected</>
        : <><span>✅</span> Back online — syncing orders...</>
      }
    </div>
  )
}
