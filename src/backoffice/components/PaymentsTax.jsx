import { supabase } from "../../lib/supabase"
import { useState, useEffect } from "react"
import { DEFAULT_PAYMENT_METHODS, mergePaymentMethods } from "../../shared/orderPricing"

const KEY = "pl_payments_settings"
const DEFAULTS = {
  tax:      { enabled:true,  rate:0,  type:"exclusive" },
  service:  { enabled:true,  rate:0 },
  rounding: { enabled:true,  roundTo:"500" },
  methods:  DEFAULT_PAYMENT_METHODS,
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}")
    return { ...DEFAULTS, ...raw, methods: mergePaymentMethods(raw.methods) }
  } catch {
    return DEFAULTS
  }
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width:48, height:26, borderRadius:13, background:on?"#0052CC":"#DFE1E6", position:"relative", cursor:"pointer", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ width:22, height:22, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left:on?24:2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
  )
}

const BUILTIN_IDS = new Set(DEFAULT_PAYMENT_METHODS.map(m => m.id))

export default function PaymentsTax() {
  const [s,       setS]       = useState(load)
  const [saved,   setSaved]   = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newMethod, setNewMethod] = useState({ name:"", icon:"💳", note:"", surcharge:0 })

  useEffect(() => {
    supabase.from("app_settings").select("payments").eq("id","main").maybeSingle()
      .then(({data}) => {
        if (data?.payments) {
          const loaded = {
            ...DEFAULTS,
            ...data.payments,
            methods: mergePaymentMethods(data.payments.methods),
          }
          setS(loaded)
        }
      })
  }, [])

  async function save(overrideState) {
    const target = (overrideState && Array.isArray(overrideState.methods)) ? overrideState : s
    const cleaned = {
      ...target,
      tax:     { ...target.tax,     rate: parseFloat(target.tax.rate) || 0 },
      service: { ...target.service, rate: parseFloat(target.service.rate) || 0 },
      methods: (target.methods || []).map(m => ({
        ...m,
        surcharge: parseFloat(m.surcharge) || 0,
      })),
    }
    localStorage.setItem(KEY, JSON.stringify(cleaned))
    await supabase.from("app_settings").upsert({ id:"main", payments:cleaned, updated_at:new Date().toISOString() }, { onConflict:"id" })
    setS(cleaned)
    setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  function updateMethod(id, key, val) {
    setS(p=>({...p, methods:p.methods.map(m=>m.id===id?{...m,[key]:val}:m)}))
  }

  function handleAddMethod() {
    const name = newMethod.name.trim()
    if (!name) return
    const id = name.replace(/\s+/g, "")
    if (s.methods.some(m => m.id.toLowerCase() === id.toLowerCase() || m.name.toLowerCase() === name.toLowerCase())) {
      alert("Metode pembayaran sudah ada!")
      return
    }
    const surcharge = parseFloat(newMethod.surcharge) || 0
    const added = {
      id,
      name,
      icon: newMethod.icon.trim() || "💳",
      note: newMethod.note.trim() || (surcharge > 0 ? `Markup +${surcharge}%` : ""),
      enabled: true,
      surcharge,
      isCustom: true,
      isOnlineApp: surcharge > 0,
    }
    const nextState = { ...s, methods: [...s.methods, added] }
    setS(nextState)
    setNewMethod({ name:"", icon:"💳", note:"", surcharge:0 })
    setShowAdd(false)
    save(nextState)
  }

  function handleRemoveMethod(id) {
    if (!window.confirm(`Hapus metode pembayaran "${id}"?`)) return
    const nextState = { ...s, methods: s.methods.filter(m => m.id !== id) }
    setS(nextState)
    save(nextState)
  }

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:16, alignItems:"start" }}>

        {/* LEFT: Payment Methods */}
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div>
              <div className="bo-card-title" style={{ marginBottom:2 }}>💳 Payment Methods & Online Channels</div>
              <div style={{ fontSize:12, color:"#6B778C" }}>
                Atur metode pembayaran aktif dan markup harga otomatis (misal +20% untuk GoFood, GrabFood, ShopeeFood).
              </div>
            </div>
            <button onClick={() => setShowAdd(v => !v)} className="bo-btn bo-btn-primary bo-btn-sm">
              {showAdd ? "Batal" : "+ Add Payment"}
            </button>
          </div>

          {showAdd && (
            <div style={{ background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:12, padding:14, marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#0A1628", marginBottom:10 }}>Tambah Metode Pembayaran Baru</div>
              <div style={{ display:"grid", gridTemplateColumns:"70px 1fr 120px", gap:8, marginBottom:8 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:"#6B778C", display:"block", marginBottom:4 }}>Icon</label>
                  <input value={newMethod.icon} onChange={e=>setNewMethod(p=>({...p,icon:e.target.value}))}
                    className="bo-input" style={{ textAlign:"center", fontSize:16 }} placeholder="💳" />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:"#6B778C", display:"block", marginBottom:4 }}>Nama Pembayaran</label>
                  <input value={newMethod.name} onChange={e=>setNewMethod(p=>({...p,name:e.target.value}))}
                    className="bo-input" placeholder="e.g. GoFood, GrabFood, ShopeeFood, EDC BCA..." />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:"#6B778C", display:"block", marginBottom:4 }}>Markup Harga (%)</label>
                  <input type="number" value={newMethod.surcharge} onChange={e=>setNewMethod(p=>({...p,surcharge:e.target.value}))}
                    className="bo-input" placeholder="0" min="0" max="100" />
                </div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input value={newMethod.note} onChange={e=>setNewMethod(p=>({...p,note:e.target.value}))}
                  className="bo-input" style={{ flex:1 }} placeholder="Catatan opsional (misal: T+1 settlement / Online App +20%)" />
                <button onClick={handleAddMethod} className="bo-btn bo-btn-primary">Simpan Metode</button>
              </div>
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column" }}>
            {s.methods.map((m,i) => {
              const markup = parseFloat(m.surcharge) || 0
              const isCustom = !BUILTIN_IDS.has(m.id) || m.isCustom
              return (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 0", borderBottom:i<s.methods.length-1?"1px solid var(--surface2)":"none", flexWrap:"wrap" }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{m.icon}</div>
                  <div style={{ flex:1, minWidth:140 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:"#0A1628" }}>{m.name}</span>
                      {markup > 0 && (
                        <span style={{ fontSize:11, fontWeight:800, padding:"2px 8px", borderRadius:10, background:"#ECFDF5", color:"#059669", border:"1px solid #A7F3D0" }}>
                          +{markup}% Harga Menu
                        </span>
                      )}
                    </div>
                    {m.note && m.note.split("\n").map((n,idx)=><div key={idx} style={{ fontSize:11, color:"#6B778C" }}>{n}</div>)}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:"#6B778C" }}>Markup:</span>
                    <input
                      type="number"
                      value={m.surcharge ?? 0}
                      onChange={e => updateMethod(m.id, "surcharge", e.target.value)}
                      className="bo-input"
                      style={{ width:68, padding:"5px 8px", fontSize:13, textAlign:"right" }}
                      min="0"
                      max="100"
                    />
                    <span style={{ fontSize:12, fontWeight:700, color:"#6B778C" }}>%</span>
                  </div>
                  {isCustom && (
                    <button onClick={() => handleRemoveMethod(m.id)} title="Hapus metode"
                      style={{ background:"none", border:"none", color:"#DC2626", cursor:"pointer", fontSize:14, padding:"4px 6px" }}>
                      ✕
                    </button>
                  )}
                  <Toggle on={m.enabled} onToggle={()=>updateMethod(m.id,"enabled",!m.enabled)} />
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Tax, Rounding, Digital */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Tax & Service */}
          <div className="bo-card" style={{ marginBottom:0 }}>
            <div className="bo-card-title">🧾 Tax & Service Charge</div>

            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>PPN</div>
                <div style={{ fontSize:12, color:"#6B778C" }}>Added on top</div>
              </div>
              <Toggle on={s.tax.enabled} onToggle={()=>setS(p=>({...p,tax:{...p.tax,enabled:!p.tax.enabled}}))} />
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              <input type="number" value={s.tax.rate} onChange={e=>setS(p=>({...p,tax:{...p.tax,rate:e.target.value}}))}
                className="bo-input" style={{ width:80 }} placeholder="0" />
              <span style={{ display:"flex", alignItems:"center", fontSize:14, fontWeight:600 }}>%</span>
              <select value={s.tax.type} onChange={e=>setS(p=>({...p,tax:{...p.tax,type:e.target.value}}))} className="bo-select" style={{ flex:1 }}>
                <option value="exclusive">Exclusive (add on top)</option>
                <option value="inclusive">Inclusive (included in price)</option>
              </select>
            </div>

            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontSize:14, fontWeight:700 }}>Service Charge</div>
              <Toggle on={s.service.enabled} onToggle={()=>setS(p=>({...p,service:{...p.service,enabled:!p.service.enabled}}))} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input type="number" value={s.service.rate} onChange={e=>setS(p=>({...p,service:{...p.service,rate:e.target.value}}))}
                className="bo-input" style={{ width:80 }} placeholder="0" />
              <span style={{ display:"flex", alignItems:"center", fontSize:14, fontWeight:600 }}>%</span>
            </div>
          </div>

          {/* Rounding */}
          <div className="bo-card" style={{ marginBottom:0 }}>
            <div className="bo-card-title">🔢 Rounding</div>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>Auto-round totals</div>
                <div style={{ fontSize:12, color:"#6B778C" }}>Round to nearest:</div>
              </div>
              <Toggle on={s.rounding.enabled} onToggle={()=>setS(p=>({...p,rounding:{...p.rounding,enabled:!p.rounding.enabled}}))} />
            </div>
            <select value={s.rounding.roundTo} onChange={e=>setS(p=>({...p,rounding:{...p.rounding,roundTo:e.target.value}}))} className="bo-select">
              <option value="100">Rp 100</option>
              <option value="500">Rp 500</option>
              <option value="1000">Rp 1.000</option>
              <option value="5000">Rp 5.000</option>
            </select>
          </div>

          {/* Digital Receipts */}
          <div className="bo-card" style={{ marginBottom:0 }}>
            <div className="bo-card-title">📱 Digital Receipts</div>
            <div style={{ fontSize:13, color:"#42526E", lineHeight:1.7 }}>
              <div>WhatsApp receipts: configure in System → Hardware</div>
              <div>Email receipts: requires SMTP configuration (coming soon)</div>
              <div>Receipt design: System → Receipt Designer</div>
            </div>
          </div>

          <button onClick={save} className="bo-btn bo-btn-primary" style={{ width:"100%" }}>
            {saved?"✓ Saved!":"Save Settings"}
          </button>
        </div>
      </div>
    </div>
  )
}
