import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { STAFF } from '../../shared/constants'

const MAX_ATTEMPTS = 5
const LOCKOUT_SECONDS = 30

export default function PinLogin({ onLogin }) {
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const [shake, setShake]       = useState(false)
  const [staffList, setStaffList] = useState(STAFF)
  const [failCount, setFailCount] = useState(0)
  const [lockoutSec, setLockoutSec] = useState(0)
  const lockoutRef = useRef(null)

  useEffect(() => {
    supabase.from('staff').select('id,name,role,pin,color,active,permissions')
      .eq('active', true).order('name')
      .then(({data}) => { if (data?.length) setStaffList(data) })
  }, [])

  useEffect(() => {
    return () => { if (lockoutRef.current) clearInterval(lockoutRef.current) }
  }, [])

  function startLockout() {
    setLockoutSec(LOCKOUT_SECONDS)
    lockoutRef.current = setInterval(() => {
      setLockoutSec(s => {
        if (s <= 1) {
          clearInterval(lockoutRef.current)
          setFailCount(0)
          setError('')
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  function handlePin(digit) {
    if (pin.length >= 4 || lockoutSec > 0) return
    const newPin = pin + digit
    setPin(newPin)
    if (newPin.length === 4) {
      const found = staffList.find(s => s.pin === newPin)
      if (found) {
        setFailCount(0)
        onLogin(found)
        setPin('')
      } else {
        const next = failCount + 1
        setFailCount(next)
        setShake(true)
        if (next >= MAX_ATTEMPTS) {
          setError('Too many attempts. Locked for ' + LOCKOUT_SECONDS + 's.')
          setPin('')
          setShake(false)
          startLockout()
        } else {
          setError('Wrong PIN (' + next + '/' + MAX_ATTEMPTS + ')')
          setTimeout(() => { setPin(''); setError(''); setShake(false) }, 800)
        }
      }
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <img src="/logo-pos.png" alt="PawonLoka" onError={e=>{e.target.style.display="none"}}
          style={{ width:80, height:80, objectFit:"contain", marginBottom:8, borderRadius:16 }} />
        <div style={{ fontSize:24, fontWeight:900, color:'#0A1628', marginBottom:4 }}>PawonLoka</div>
        <div style={{ fontSize:14, color:'#6B7A8D', marginBottom:28 }}>Enter your PIN to continue</div>

        <div style={{ ...S.dots, animation: shake ? 'shake 0.4s' : 'none' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width:14, height:14, borderRadius:'50%',
              background: pin.length > i ? '#0A1628' : 'white',
              border: '2px solid ' + (pin.length > i ? '#0A1628' : '#CBD5E1'),
              transition: 'all 0.15s'
            }}/>
          ))}
        </div>

        {lockoutSec > 0
          ? <div style={{ color:'#EF4444', fontSize:13, fontWeight:600, marginBottom:12, height:20 }}>Locked — try again in {lockoutSec}s</div>
          : error
            ? <div style={{ color:'#EF4444', fontSize:13, fontWeight:600, marginBottom:12, height:20 }}>{error}</div>
            : <div style={{ height:20, marginBottom:12 }}/>
        }

        <div style={{ ...S.numpad, opacity: lockoutSec > 0 ? 0.35 : 1, pointerEvents: lockoutSec > 0 ? 'none' : 'auto' }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d,i) => (
            <button
              key={i}
              style={{ ...S.key, visibility: d==='' ? 'hidden' : 'visible' }}
              onClick={() => d==='⌫' ? setPin(p => p.slice(0,-1)) : handlePin(d)}
            >{d}</button>
          ))}
        </div>


      </div>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
      `}</style>
    </div>
  )
}

const S = {
  wrap:   { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'linear-gradient(135deg,#0A1628 0%,#1E3A5F 100%)' },
  card:   { background:'white', borderRadius:24, padding:'32px 28px', width:320, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' },
  dots:   { display:'flex', justifyContent:'center', gap:12, marginBottom:8 },
  numpad: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 },
  key:    { padding:16, borderRadius:14, border:'1.5px solid #E2E8F0', background:'white', fontSize:20, fontWeight:700, cursor:'pointer', color:'#0A1628', outline:'none', transition:'background 0.1s' },
}
