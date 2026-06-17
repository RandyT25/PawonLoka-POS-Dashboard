import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../shared/constants'

export default function ReprintModal({ onClose, onReprint }) {
  const [orders, setOrders]   = useState([])
  const [filtered, setFiltered] = useState([])
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('orders')
      .select('id,total,pay,staff,table,customer,items,created_at,time,date,subtotal,tax,discount,change,status,notes')
      .eq('status', 'Paid')
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(60)
    setOrders(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  function search(q) {
    setQuery(q)
    if (!q.trim()) { setFiltered(orders); return }
    const lq = q.toLowerCase()
    setFiltered(orders.filter(o =>
      o.id.toLowerCase().includes(lq) ||
      (o.table || '').toLowerCase().includes(lq) ||
      (o.staff || '').toLowerCase().includes(lq) ||
      (o.customer || '').toLowerCase().includes(lq) ||
      String(o.total).includes(lq)
    ))
  }

  async function handleReprint(order) {
    setPrinting(order.id)
    try {
      await onReprint(order)
    } finally {
      setPrinting(null)
    }
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff',borderRadius:16,width:'100%',maxWidth:480,maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'14px 18px',borderBottom:'1px solid #E2E8F0',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:800,fontSize:16 }}>Cetak Ulang Struk</div>
            <div style={{ fontSize:11,color:'#64748B',marginTop:1 }}>Pilih transaksi hari ini</div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#94A3B8',lineHeight:1 }}>✕</button>
        </div>

        {/* Search */}
        <div style={{ padding:'10px 16px',borderBottom:'1px solid #F1F5F9' }}>
          <input
            value={query}
            onChange={e => search(e.target.value)}
            placeholder="Cari meja, kasir, total..."
            style={{ width:'100%',padding:'8px 12px',border:'1.5px solid #E2E8F0',borderRadius:8,fontSize:13,boxSizing:'border-box',outline:'none' }}
            autoFocus
          />
        </div>

        {/* List */}
        <div style={{ overflowY:'auto',flex:1 }}>
          {loading && (
            <div style={{ textAlign:'center',padding:32,color:'#94A3B8',fontSize:13 }}>Loading...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign:'center',padding:32,color:'#94A3B8',fontSize:13 }}>
              {orders.length === 0 ? 'Belum ada transaksi hari ini' : 'Tidak ditemukan'}
            </div>
          )}
          {filtered.map(o => {
            const timeStr = o.time || new Date(o.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
            const items   = Array.isArray(o.items) ? o.items : []
            const isPrinting = printing === o.id
            return (
              <div key={o.id}
                style={{ padding:'12px 16px',borderBottom:'1px solid #F8FAFC',display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3 }}>
                    <span style={{ fontSize:13,fontWeight:700,color:'#0F172A' }}>
                      {o.table || 'Walk-in'} · {o.staff}
                    </span>
                    <span style={{ fontSize:13,fontWeight:800,color:'#0F172A',flexShrink:0 }}>{fmt(o.total)}</span>
                  </div>
                  <div style={{ display:'flex',gap:8,fontSize:11,color:'#64748B' }}>
                    <span>{timeStr}</span>
                    <span>·</span>
                    <span>{o.pay}</span>
                    <span>·</span>
                    <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    {o.customer && <><span>·</span><span>{o.customer}</span></>}
                  </div>
                  <div style={{ fontSize:11,color:'#94A3B8',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                    {items.slice(0,3).map(i=>`${i.qty}× ${i.name}`).join(', ')}
                    {items.length > 3 ? ` +${items.length - 3} lagi` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleReprint(o)}
                  disabled={!!printing}
                  style={{ flexShrink:0,padding:'8px 14px',background: isPrinting ? '#E2E8F0' : '#0A1628',color: isPrinting ? '#64748B' : '#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor: printing ? 'default' : 'pointer' }}>
                  {isPrinting ? '...' : '🖨 Cetak'}
                </button>
              </div>
            )
          })}
        </div>

        <div style={{ padding:'10px 16px',borderTop:'1px solid #E2E8F0',fontSize:11,color:'#94A3B8',textAlign:'center' }}>
          {filtered.length} transaksi · hari ini
        </div>
      </div>
    </div>
  )
}
