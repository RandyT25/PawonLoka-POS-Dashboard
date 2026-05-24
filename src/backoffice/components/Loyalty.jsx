import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }

function tierInfo(points) {
  if (points >= 5000) return { label:"Gold",   color:"#FF8B00", bg:"#FFF7E6" }
  if (points >= 1000) return { label:"Silver", color:"#6B778C", bg:"#F4F5F7" }
  return                     { label:"Bronze", color:"#E65100", bg:"#FFF3E0" }
}

const MEDAL = ["🥇","🥈","🥉"]

export default function Loyalty() {
  const [settings, setSettings] = useState({ points_per_100:1, gold_threshold:5000, silver_threshold:1000 })
  const [vouchers, setVouchers] = useState([])
  const [customers,setCustomers]= useState([])
  const [loading,  setLoading]  = useState(true)
  const [saved,    setSaved]    = useState(false)
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState({ code:"", type:"Percentage", discount:10, min_order:0, max_uses:100, expiry:"", active:true })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:vs }, { data:cs }, { data:appS }] = await Promise.all([
      supabase.from("vouchers").select("*").order("created_at",{ascending:false}),
      supabase.from("customers").select("id,name,phone,points,visits,totalSpend,tier").order("points",{ascending:false}).limit(20),
      supabase.from("app_settings").select("loyalty").eq("id","main").maybeSingle(),
    ])
    setVouchers(vs||[])
    setCustomers(cs||[])
    if (appS?.loyalty) setSettings(s=>({...s,...appS.loyalty}))
    setLoading(false)
  }

  async function saveSettings() {
    await supabase.from("app_settings").upsert({ id:"main", loyalty:settings, updated_at:new Date().toISOString() })
    setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  async function saveVoucher() {
    if (!form.code) return
    await supabase.from("vouchers").insert({
      id:"VCH-"+Date.now(), code:form.code.toUpperCase().trim(),
      type:form.type, value:parseFloat(form.discount)||0,
      min_order:parseInt(form.min_order)||0, max_uses:parseInt(form.max_uses)||100,
      used_count:0, active:form.active,
      expires_at:form.expiry||null
    })
    setModal(false)
    setForm({ code:"", type:"Percentage", discount:10, min_order:0, max_uses:100, expiry:"", active:true })
    load()
  }

  async function toggleVoucher(v) {
    await supabase.from("vouchers").update({ active:!v.active }).eq("id",v.id)
    setVouchers(prev=>prev.map(x=>x.id===v.id?{...x,active:!x.active}:x))
  }

  async function deleteVoucher(id) {
    if (!confirm("Delete voucher?")) return
    await supabase.from("vouchers").delete().eq("id",id)
    setVouchers(prev=>prev.filter(v=>v.id!==id))
  }

  async function redeemPoints(c) {
    const pts = parseInt(prompt(`Redeem points for ${c.name}\nCurrent: ${c.points} pts\nHow many to redeem?`)||"0")
    if (!pts || pts <= 0) return
    const newPts = Math.max(0,(c.points||0)-pts)
    await supabase.from("customers").update({ points:newPts }).eq("id",c.id)
    load()
  }

  return (
    <div>
      {/* Top row: Settings + Vouchers side by side */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>

        {/* Loyalty Settings */}
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title">⚙️ Loyalty Program Settings</div>
          <div className="bo-form-row">
            <label className="bo-label">Points per Rp 100 (1pt = Rp 100)</label>
            <input type="number" value={settings.points_per_100} onChange={e=>setSettings(s=>({...s,points_per_100:parseFloat(e.target.value)||0}))} className="bo-input" style={{ maxWidth:120 }} />
          </div>
          <div className="bo-form-row">
            <label className="bo-label">Gold Threshold (points)</label>
            <input type="number" value={settings.gold_threshold} onChange={e=>setSettings(s=>({...s,gold_threshold:parseInt(e.target.value)||0}))} className="bo-input" style={{ maxWidth:120 }} />
          </div>
          <div className="bo-form-row">
            <label className="bo-label">Silver Threshold (points)</label>
            <input type="number" value={settings.silver_threshold} onChange={e=>setSettings(s=>({...s,silver_threshold:parseInt(e.target.value)||0}))} className="bo-input" style={{ maxWidth:120 }} />
          </div>
          <button onClick={saveSettings} className="bo-btn bo-btn-primary" style={{ width:"100%", marginTop:8 }}>
            {saved?"✓ Saved!":"Save Settings"}
          </button>
        </div>

        {/* Vouchers */}
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div className="bo-card-title" style={{ margin:0 }}>🎟️ Vouchers & Codes</div>
            <button onClick={()=>setModal(true)} className="bo-btn bo-btn-ghost bo-btn-sm">+ New Voucher</button>
          </div>
          {loading ? <div style={{ color:"var(--ink5)", fontSize:13 }}>Loading...</div> : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {vouchers.map(v => {
                const isExpired = v.expires_at && new Date(v.expires_at) < new Date()
                const isFull    = v.max_uses > 0 && (v.used_count||0) >= v.max_uses
                const status    = !v.active||isExpired||isFull ? "expired" : "active"
                return (
                  <div key={v.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid var(--surface2)" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:"var(--brand)", fontFamily:"monospace" }}>{v.code}</div>
                      <div style={{ fontSize:11, color:"var(--ink4)" }}>
                        {v.type==="Percentage"?`${v.value}% off`:`Rp ${(v.value||0).toLocaleString("id-ID")} off`} · Used: {v.used_count||0}/{v.max_uses||"∞"}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10,
                        background:status==="active"?"#E3FCEF":"#FFEBE6",
                        color:status==="active"?"#00875A":"#DE350B" }}>{status}</span>
                      <button onClick={()=>toggleVoucher(v)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ fontSize:11 }}>{v.active?"Disable":"Enable"}</button>
                      <button onClick={()=>deleteVoucher(v.id)} className="bo-btn bo-btn-danger bo-btn-sm" style={{ fontSize:11 }}>✕</button>
                    </div>
                  </div>
                )
              })}
              {vouchers.length===0 && <div style={{ color:"var(--ink5)", fontSize:13, padding:"12px 0" }}>No vouchers yet</div>}
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bo-card">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div className="bo-card-title" style={{ margin:0 }}>🏆 Leaderboard</div>
          <div style={{ fontSize:12, color:"var(--ink4)" }}>Top customers by points</div>
        </div>
        <div className="bo-card" style={{ padding:0, overflow:"hidden", marginBottom:0 }}>
          <table className="bo-table">
            <thead>
              <tr><th>#</th><th>Customer</th><th>Tier</th><th>Points</th><th>Visits</th><th>Total Spent</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {customers.map((c,i) => {
                const t = tierInfo(c.points||0)
                return (
                  <tr key={c.id}>
                    <td style={{ fontSize:18, textAlign:"center" }}>{i<3?MEDAL[i]:i+1}</td>
                    <td>
                      <div style={{ fontWeight:700 }}>{c.name}</div>
                      <div style={{ fontSize:11, color:"var(--ink4)" }}>{c.phone}</div>
                    </td>
                    <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:t.bg, color:t.color }}>{t.label}</span></td>
                    <td style={{ fontWeight:700, color:"var(--amber)" }}>{(c.points||0).toLocaleString("id-ID")}</td>
                    <td>{c.visits||0}</td>
                    <td style={{ fontWeight:600, color:"var(--brand)" }}>{fmt(c.totalSpend||0)}</td>
                    <td>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={()=>redeemPoints(c)} className="bo-btn bo-btn-ghost bo-btn-sm">Redeem</button>
                        <button className="bo-btn bo-btn-ghost bo-btn-sm">Send Voucher</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {customers.length===0 && <tr><td colSpan={7} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>No customers yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Voucher Modal */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="bo-modal" style={{ maxWidth:440 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">New Voucher</div>
              <button className="bo-modal-close" onClick={()=>setModal(false)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row">
                <label className="bo-label">Voucher Code *</label>
                <input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} className="bo-input" placeholder="e.g. WELCOME10" style={{ fontFamily:"monospace", fontWeight:700, letterSpacing:2 }} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Type</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className="bo-select">
                    <option value="Percentage">Percentage (%)</option>
                    <option value="Fixed">Fixed (Rp)</option>
                  </select>
                </div>
                <div><label className="bo-label">Value</label>
                  <input type="number" value={form.discount} onChange={e=>setForm(f=>({...f,discount:e.target.value}))} className="bo-input" placeholder={form.type==="Percentage"?"10":"20000"} /></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Min Order (Rp)</label><input type="number" value={form.min_order} onChange={e=>setForm(f=>({...f,min_order:e.target.value}))} className="bo-input" /></div>
                <div><label className="bo-label">Max Uses</label><input type="number" value={form.max_uses} onChange={e=>setForm(f=>({...f,max_uses:e.target.value}))} className="bo-input" /></div>
              </div>
              <div className="bo-form-row"><label className="bo-label">Expiry Date</label><input type="date" value={form.expiry} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))} className="bo-input" /></div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setModal(false)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={saveVoucher} disabled={!form.code} className="bo-btn bo-btn-primary">Create Voucher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
