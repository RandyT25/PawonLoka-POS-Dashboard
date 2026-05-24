import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"

const DEFAULTS = {
  outlet: { name:"PawonLoka", tagline:"Rasa yang lahir dari dapur penuh cerita", address:"Bali, Indonesia", phone:"", email:"", website:"", instagram:"@pawonloka", wifi:"" },
  pos_behaviour: { auto_print_receipt:true, kitchen_display:true, cashier_discounts:true, require_pin_void:true, require_pin_refund:true, auto_member_discount:true },
  regional: { currency:"IDR", timezone:"WITA", date_format:"DD/MM/YYYY" },
  loyalty: { points_per_100:1, gold_threshold:5000, silver_threshold:2000 },
  stations: [{ id:"kitchen",name:"Kitchen",icon:"🍳" },{ id:"bar",name:"Bar",icon:"🍹" },{ id:"snack",name:"Snack",icon:"🍟" },{ id:"kasir",name:"Kasir",icon:"🧾" }],
}

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [tab,      setTab]      = useState("outlet")
  const [newStation, setNewStation] = useState({ name:"", icon:"🍳" })
  const [editStation, setEditStation] = useState(null)
  const [categories, setCategories] = useState([])
  const [catRouting, setCatRouting] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:s }, { data:cats }] = await Promise.all([
      supabase.from("app_settings").select("*").eq("id","main").maybeSingle(),
      supabase.from("categories").select("id,name,icon").order("sort"),
    ])
    if (s) setSettings({ outlet:s.outlet||DEFAULTS.outlet, pos_behaviour:s.pos_behaviour||DEFAULTS.pos_behaviour, regional:s.regional||DEFAULTS.regional, loyalty:s.loyalty||DEFAULTS.loyalty, stations:s.stations||DEFAULTS.stations })
    setCategories(cats||[])
    // Load category routing from localStorage for now
    try { setCatRouting(JSON.parse(localStorage.getItem("pl_cat_routing")||"{}")) } catch {}
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from("app_settings").upsert({ id:"main", ...settings, updated_at:new Date().toISOString() })
    localStorage.setItem("pl_cat_routing", JSON.stringify(catRouting))
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function update(section, key, val) {
    setSettings(s => ({ ...s, [section]: { ...s[section], [key]: val } }))
  }

  function addStation() {
    if (!newStation.name) return
    const id = newStation.name.toLowerCase().replace(/\s+/g,"-")
    setSettings(s => ({ ...s, stations: [...(s.stations||[]), { ...newStation, id }] }))
    setNewStation({ name:"", icon:"🍳" })
  }

  function removeStation(id) {
    setSettings(s => ({ ...s, stations: (s.stations||[]).filter(st=>st.id!==id) }))
  }

  const TABS = [
    ["outlet","🏪 Outlet"],["pos","🧾 POS"],["regional","🌍 Regional"],
    ["loyalty","⭐ Loyalty"],["stations","🍳 Stations"],
  ]

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>

  return (
    <div style={{ maxWidth:700 }}>
      {/* Tab nav */}
      <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
        {TABS.map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={"bo-btn bo-btn-sm "+(tab===t?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
        ))}
        <button onClick={save} disabled={saving} className="bo-btn bo-btn-sm" style={{ marginLeft:"auto", background:"var(--green)", color:"#fff", border:"none" }}>
          {saving?"Saving...":saved?"✓ Saved":"Save All"}
        </button>
      </div>

      {tab==="outlet" && (
        <div className="bo-card">
          <div className="bo-card-title">🏪 Outlet Information</div>
          {[["name","Outlet Name"],["tagline","Tagline"],["address","Address"],["phone","Phone"],["email","Email"],["website","Website"],["instagram","Instagram / Social"],["wifi","WiFi Password"]].map(([k,l])=>(
            <div key={k} className="bo-form-row">
              <label className="bo-label">{l}</label>
              <input value={settings.outlet[k]||""} onChange={e=>update("outlet",k,e.target.value)} className="bo-input" />
            </div>
          ))}
          <div style={{ marginTop:8, padding:"10px 14px", background:"var(--surface)", borderRadius:"var(--r)", fontSize:12, color:"var(--ink4)" }}>
            App version: PawonLoka v1.0 · Built with React + Supabase + Cloudflare Pages
          </div>
        </div>
      )}

      {tab==="pos" && (
        <div className="bo-card">
          <div className="bo-card-title">🧾 POS Behaviour</div>
          {[
            ["auto_print_receipt","Auto-print receipt on sale"],
            ["kitchen_display","Kitchen Display / Tickets"],
            ["cashier_discounts","Allow cashier discounts"],
            ["require_pin_void","Require PIN for void"],
            ["require_pin_refund","Require PIN for refund"],
            ["auto_member_discount","Auto-apply member discount (Gold 5%)"],
          ].map(([k,l])=>(
            <label key={k} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--surface2)", cursor:"pointer" }}>
              <span style={{ fontSize:13, fontWeight:600 }}>{l}</span>
              <div onClick={()=>update("pos_behaviour",k,!settings.pos_behaviour[k])}
                style={{ width:44, height:24, borderRadius:12, background:settings.pos_behaviour[k]?"var(--green)":"var(--surface3)", position:"relative", cursor:"pointer", transition:"background 0.2s", flexShrink:0 }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left:settings.pos_behaviour[k]?22:2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
            </label>
          ))}
        </div>
      )}

      {tab==="regional" && (
        <div className="bo-card">
          <div className="bo-card-title">🌍 Regional & Format</div>
          <div className="bo-form-row">
            <label className="bo-label">Currency</label>
            <div style={{ display:"flex", gap:8 }}>
              {["IDR","USD"].map(c=>(
                <button key={c} onClick={()=>update("regional","currency",c)} className={"bo-btn bo-btn-sm "+(settings.regional.currency===c?"bo-btn-primary":"bo-btn-ghost")}>
                  {c==="IDR"?"IDR — Indonesian Rupiah":"USD — US Dollar"}
                </button>
              ))}
            </div>
          </div>
          <div className="bo-form-row">
            <label className="bo-label">Timezone</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[["WITA","WITA — Bali/Makassar"],["WIB","WIB — Jakarta"],["WIT","WIT — East Indonesia"]].map(([v,l])=>(
                <button key={v} onClick={()=>update("regional","timezone",v)} className={"bo-btn bo-btn-sm "+(settings.regional.timezone===v?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
              ))}
            </div>
          </div>
          <div className="bo-form-row">
            <label className="bo-label">Date Format</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD"].map(v=>(
                <button key={v} onClick={()=>update("regional","date_format",v)} className={"bo-btn bo-btn-sm "+(settings.regional.date_format===v?"bo-btn-primary":"bo-btn-ghost")}>{v}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==="loyalty" && (
        <div className="bo-card">
          <div className="bo-card-title">⭐ Loyalty Program</div>
          {[["points_per_100","Points per Rp 100 spent"],["gold_threshold","Gold Threshold (pts)"],["silver_threshold","Silver Threshold (pts)"]].map(([k,l])=>(
            <div key={k} className="bo-form-row">
              <label className="bo-label">{l}</label>
              <input type="number" value={settings.loyalty[k]||0} onChange={e=>update("loyalty",k,parseFloat(e.target.value)||0)} className="bo-input" style={{ maxWidth:160 }} />
            </div>
          ))}
          <div style={{ padding:"10px 14px", background:"var(--brand-lt)", borderRadius:"var(--r)", fontSize:12, color:"var(--brand)", fontWeight:600 }}>
            Gold: {settings.loyalty.gold_threshold?.toLocaleString("id-ID")} pts · Silver: {settings.loyalty.silver_threshold?.toLocaleString("id-ID")} pts · {settings.loyalty.points_per_100} pt per Rp 100
          </div>
        </div>
      )}

      {tab==="stations" && (
        <>
          <div className="bo-card">
            <div className="bo-card-title">🍳 Kitchen Stations</div>
            <div style={{ fontSize:12, color:"var(--ink4)", marginBottom:14 }}>Items automatically route to the correct station when charged.</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
              {(settings.stations||[]).map(st=>(
                <div key={st.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"var(--surface)", borderRadius:"var(--r)", border:"1px solid var(--surface3)" }}>
                  <span style={{ fontSize:20 }}>{st.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{st.name}</div>
                    <div style={{ fontSize:11, color:"var(--ink5)" }}>ID: {st.id}</div>
                  </div>
                  <button onClick={()=>removeStation(st.id)} style={{ background:"none", border:"none", color:"var(--red)", cursor:"pointer", fontSize:16 }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"60px 1fr auto", gap:8 }}>
              <input value={newStation.icon} onChange={e=>setNewStation(s=>({...s,icon:e.target.value}))} className="bo-input" placeholder="🍳" style={{ textAlign:"center", fontSize:20 }} />
              <input value={newStation.name} onChange={e=>setNewStation(s=>({...s,name:e.target.value}))} className="bo-input" placeholder="Station name" onKeyDown={e=>e.key==="Enter"&&addStation()} />
              <button onClick={addStation} className="bo-btn bo-btn-primary">+ Add</button>
            </div>
          </div>

          <div className="bo-card">
            <div className="bo-card-title">Category → Station Routing</div>
            <div style={{ fontSize:12, color:"var(--ink4)", marginBottom:14 }}>Assign each category to a station. Changes take effect immediately in POS.</div>
            {categories.map(cat=>(
              <div key={cat.id||cat.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid var(--surface2)" }}>
                <span style={{ fontSize:18, width:28 }}>{cat.icon||"🍽"}</span>
                <span style={{ flex:1, fontSize:13, fontWeight:600 }}>{cat.name}</span>
                <select value={catRouting[cat.name]||""} onChange={e=>setCatRouting(r=>({...r,[cat.name]:e.target.value}))} className="bo-select" style={{ maxWidth:160, fontSize:12 }}>
                  <option value="">— No routing —</option>
                  {(settings.stations||[]).map(st=><option key={st.id} value={st.id}>{st.icon} {st.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
        <button onClick={save} disabled={saving} className="bo-btn bo-btn-primary" style={{ minWidth:140 }}>
          {saving?"Saving...":saved?"✓ Saved!":"Save Settings"}
        </button>
      </div>
    </div>
  )
}
