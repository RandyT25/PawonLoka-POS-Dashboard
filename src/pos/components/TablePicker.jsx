import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { qr } from '../../lib/quickRead'

export default function TablePicker({ current, onSelect, onSelectOccupied, onClose }) {
  const [tables, setTables] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0,10)
      const tbls = (await qr(supabase.from('tables').select('*').order('sort'), { cache:'tables', ms:5000 })) || []
      const open  = (await qr(supabase.from('orders').select('id,table,table_area,customer').eq('status','Open').eq('date',today), { ms:3000 })) || []
      const occupiedMap = {}
      ;(open||[]).forEach(o => {
        if (!o.table) return
        if (o.table_area) occupiedMap[`${o.table_area}::${o.table}`] = { id: o.id, customer: o.customer }
        else occupiedMap[o.table] = { id: o.id, customer: o.customer }
      })
      setTables((tbls||[]).map(t => {
        const hit = occupiedMap[`${t.area}::${t.name}`] || occupiedMap[t.name]
        return {
          ...t,
          occupied: !!hit,
          open_bill_id: hit?.id || null,
          open_customer: hit?.customer || null,
        }
      }).sort((a, b) => {
        const na = a.name.replace(/(\d+)/g, n => n.padStart(10, '0'))
        const nb = b.name.replace(/(\d+)/g, n => n.padStart(10, '0'))
        return na.localeCompare(nb)
      }))
    }
    load()

    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const areas = [...new Set(tables.map(t => t.area).filter(Boolean))]

  function handleClick(t) {
    if (t.status === 'Reserved') return
    if (t.occupied && t.open_bill_id) {
      onSelectOccupied(t)
    } else {
      onSelect(t)
    }
    onClose()
  }

  return (
    <div ref={ref} style={S.dropdown}>
      {areas.map(area => (
        <div key={area}>
          <div style={S.areaLabel}>{area}</div>
          {tables.filter(t => t.area === area).map(t => (
            <button key={t.id} onClick={() => handleClick(t)}
              style={{
                ...S.row,
                background: t.name === current ? '#EFF6FF' : 'white',
                opacity: t.status === 'Reserved' ? 0.4 : 1,
                cursor: t.status === 'Reserved' ? 'not-allowed' : 'pointer',
              }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                  background: t.occupied ? '#F97316' : t.status==='Reserved' ? '#94A3B8' : '#22C55E' }} />
                <span style={{ fontWeight: t.name===current ? 800 : 600, fontSize:13 }}>{t.name}</span>
                <span style={{ fontSize:11, color:'#94A3B8' }}>{t.capacity} seats</span>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11, fontWeight:600,
                  color: t.occupied ? '#EA580C' : t.status==='Reserved' ? '#94A3B8' : '#16A34A' }}>
                  {t.occupied ? 'Occupied' : t.status==='Reserved' ? 'Reserved' : 'Available'}
                </div>
                {t.open_customer && <div style={{ fontSize:10, color:'#94A3B8' }}>{t.open_customer}</div>}
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

const S = {
  dropdown: { position:'absolute', top:48, left:0, background:'white', borderRadius:14, width:280, boxShadow:'0 8px 32px rgba(9,30,66,0.2)', border:'1px solid #E2E8F0', zIndex:3000, maxHeight:380, overflowY:'auto' },
  areaLabel:{ padding:'8px 14px 4px', fontSize:10, fontWeight:800, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px' },
  row:      { width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 14px', border:'none', background:'white', cursor:'pointer', borderBottom:'1px solid #F1F5F9' },
}
