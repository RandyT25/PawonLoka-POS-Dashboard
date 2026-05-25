import { useState } from "react"

const KEY = "pl_payments_settings"
const DEFAULTS = {
  tax:      { enabled:true,  rate:0,  type:"exclusive" },
  service:  { enabled:true,  rate:0 },
  rounding: { enabled:true,  roundTo:"500" },
  methods: [
    { id:"Cash",      name:"Cash",         icon:"💵", note:"",               enabled:true,  surcharge:0 },
    { id:"QRIS",      name:"QRIS",         icon:"📲", note:"T+1 settlement",  enabled:true,  surcharge:0 },
    { id:"GoPay",     name:"GoPay",        icon:"🟦", note:"T+1 settlement",  enabled:false, surcharge:0 },
    { id:"OVO",       name:"OVO",          icon:"🟣", note:"T+1 settlement",  enabled:false, surcharge:0 },
    { id:"ShopeePay", name:"ShopeePay",    icon:"🧡", note:"T+1 settlement",  enabled:false, surcharge:0 },
    { id:"DANA",      name:"DANA",         icon:"🔵", note:"T+1 settlement",  enabled:false, surcharge:0 },
    { id:"Card",      name:"Debit/Credit", icon:"💳", note:"Surcharge: 1.5%\nT+2 settlement", enabled:true,  surcharge:1.5 },
    { id:"Transfer",  name:"Bank Transfer",icon:"🏦", note:"T+1 settlement",  enabled:false, surcharge:0 },
  ]
}

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)||"{}") } }
  catch { return DEFAULTS }
}
async function loadFromDB() {
  const { data } = await supabase.from("app_settings").select("payments").eq("id","main").maybeSingle()
  if (data?.payments) return { ...DEFAULTS, ...data.payments }
  return load()
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width:48, height:26, borderRadius:13, background:on?"#0052CC":"#DFE1E6", position:"relative", cursor:"pointer", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ width:22, height:22, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left:on?24:2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
  )
}

export default function PaymentsTax() {
  const [s,     setS]     = useState(load)
  const [saved, setSaved] = useState(false)

  function save() {
    localStorage.setItem(KEY, JSON.stringify(s))
    setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  function updateMethod(id, key, val) {
    setS(p=>({...p, methods:p.methods.map(m=>m.id===id?{...m,[key]:val}:m)}))
  }

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:16, alignItems:"start" }}>

        {/* LEFT: Payment Methods */}
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title">💳 Payment Methods</div>
          <div style={{ display:"flex", flexDirection:"column" }}>
            {s.methods.map((m,i) => (
              <div key={m.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 0", borderBottom:i<s.methods.length-1?"1px solid var(--surface2)":"none" }}>
                <div style={{ width:36, height:36, borderRadius:8, background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{m.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#0A1628" }}>{m.name}</div>
                  {m.note && m.note.split("\n").map((n,i)=><div key={i} style={{ fontSize:11, color:"#6B778C" }}>{n}</div>)}
                </div>
                <Toggle on={m.enabled} onToggle={()=>updateMethod(m.id,"enabled",!m.enabled)} />
              </div>
            ))}
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
              <input type="number" value={s.tax.rate} onChange={e=>setS(p=>({...p,tax:{...p.tax,rate:parseFloat(e.target.value)||0}}))}
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
              <input type="number" value={s.service.rate} onChange={e=>setS(p=>({...p,service:{...p.service,rate:parseFloat(e.target.value)||0}}))}
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
