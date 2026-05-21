import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"

function fmt(n) { return Number(n||0).toLocaleString("id-ID") }
const REASONS = ["Expired","Damaged","Overproduction","Spillage","Other"]

export default function StaffPortal() {
  const [screen,      setScreen]      = useState("home")
  const [ingredients, setIngredients] = useState([])
  const [staffName,   setStaffName]   = useState(localStorage.getItem("staff_name")||"")
  const [nameSet,     setNameSet]     = useState(!!localStorage.getItem("staff_name"))
  const [saving,      setSaving]      = useState(false)
  const [done,        setDone]        = useState(false)
  const [opnameCounts,setOpnameCounts]= useState([])
  const [wasteForm,   setWasteForm]   = useState({ ingredient_id:"", qty:"", reason:"Expired", notes:"" })
  const [prodForm,    setProdForm]    = useState({ item_id:"", batch_qty:"", unit:"", notes:"" })
  const [prodUsed,    setProdUsed]    = useState([{ ingredient_id:"", qty:"", unit:"" }])
  const [search,      setSearch]      = useState("")

  useEffect(() => { loadIngredients() }, [])

  async function loadIngredients() {
    const { data } = await supabase.from("ingredients").select("id,name,unit,stock,cost_per_unit").order("name")
    setIngredients(data||[])
    setOpnameCounts((data||[]).map(i=>({ ingredient_id:i.id, name:i.name, unit:i.unit, system_qty:i.stock||0, actual_qty:"" })))
  }

  function saveName() {
    if (!staffName.trim()) return
    localStorage.setItem("staff_name", staffName.trim())
    setNameSet(true)
  }

  async function submitOpname() {
    const filled = opnameCounts.filter(i=>i.actual_qty!=="")
    if (!filled.length) { alert("Enter at least one count"); return }
    setSaving(true)
    await supabase.from("staff_submissions").insert({
      id:"SS-"+Date.now(), type:"opname", status:"pending",
      submitted_by:staffName, submitted_at:new Date().toISOString(),
      data:{ items:filled.map(i=>({ ...i, actual_qty:parseFloat(i.actual_qty)||0, diff:(parseFloat(i.actual_qty)||0)-i.system_qty })) }
    })
    setSaving(false); setDone(true)
  }

  async function submitWaste() {
    const ing = ingredients.find(i=>i.id===wasteForm.ingredient_id)
    if (!ing||!wasteForm.qty) { alert("Select ingredient and quantity"); return }
    setSaving(true)
    await supabase.from("staff_submissions").insert({
      id:"SS-"+Date.now(), type:"waste", status:"pending",
      submitted_by:staffName, submitted_at:new Date().toISOString(),
      data:{ ingredient_id:ing.id, ingredient_name:ing.name, qty:parseFloat(wasteForm.qty), unit:ing.unit, reason:wasteForm.reason, notes:wasteForm.notes, estimated_cost:(parseFloat(wasteForm.qty)||0)*(ing.cost_per_unit||0) }
    })
    setSaving(false); setDone(true)
  }

  async function submitProduction() {
    const item = ingredients.find(i=>i.id===prodForm.item_id)
    if (!item||!prodForm.batch_qty) { alert("Select item and quantity"); return }
    const validUsed = prodUsed.filter(u=>u.ingredient_id&&parseFloat(u.qty)>0)
    if (!validUsed.length) { alert("Add ingredients used"); return }
    setSaving(true)
    await supabase.from("staff_submissions").insert({
      id:"SS-"+Date.now(), type:"production", status:"pending",
      submitted_by:staffName, submitted_at:new Date().toISOString(),
      data:{ item_id:item.id, item_name:item.name, batch_qty:parseFloat(prodForm.batch_qty), unit:prodForm.unit||item.unit, notes:prodForm.notes, ingredients_used:validUsed.map(u=>{ const ing=ingredients.find(i=>i.id===u.ingredient_id); return { ingredient_id:u.ingredient_id, name:ing?.name||"", qty:parseFloat(u.qty), unit:u.unit||ing?.unit||"" } }) }
    })
    setSaving(false); setDone(true)
  }

  function reset() {
    setDone(false); setScreen("home"); setSearch("")
    setWasteForm({ ingredient_id:"", qty:"", reason:"Expired", notes:"" })
    setProdForm({ item_id:"", batch_qty:"", unit:"", notes:"" })
    setProdUsed([{ ingredient_id:"", qty:"", unit:"" }])
  }

  const s = {
    wrap:{ minHeight:"100vh", background:"#f5f6fa", fontFamily:"system-ui,sans-serif", fontSize:15 },
    header:{ background:"#0066ff", color:"#fff", padding:"14px 18px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 },
    body:{ padding:"14px 16px", maxWidth:480, margin:"0 auto" },
    card:{ background:"#fff", borderRadius:14, padding:16, marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,0.06)" },
    label:{ fontSize:12, fontWeight:700, color:"#666", marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:"0.4px" },
    input:{ width:"100%", padding:"11px 13px", border:"1.5px solid #e0e0e0", borderRadius:10, fontSize:15, boxSizing:"border-box", fontFamily:"inherit", outline:"none" },
    btn:{ width:"100%", padding:"14px", borderRadius:12, border:"none", fontSize:15, fontWeight:700, cursor:"pointer", marginBottom:8, fontFamily:"inherit" },
  }

  if (!nameSet) return (
    <div style={s.wrap}>
      <div style={s.header}><span style={{ fontSize:22 }}>🍳</span><span style={{ fontSize:17, fontWeight:800 }}>PawonLoka Staff</span></div>
      <div style={s.body}>
        <div style={{ ...s.card, marginTop:32 }}>
          <div style={{ fontSize:17, fontWeight:800, marginBottom:4 }}>Who are you?</div>
          <div style={{ fontSize:13, color:"#888", marginBottom:16 }}>Enter your name to continue</div>
          <label style={s.label}>Your Name</label>
          <input style={s.input} value={staffName} onChange={e=>setStaffName(e.target.value)} placeholder="e.g. Budi" onKeyDown={e=>e.key==="Enter"&&saveName()} autoFocus />
          <button onClick={saveName} style={{ ...s.btn, background:"#0066ff", color:"#fff", marginTop:14 }}>Continue →</button>
        </div>
      </div>
    </div>
  )

  if (done) return (
    <div style={s.wrap}>
      <div style={s.header}><span style={{ fontSize:22 }}>🍳</span><span style={{ fontSize:17, fontWeight:800 }}>PawonLoka Staff</span></div>
      <div style={{ ...s.body, textAlign:"center", paddingTop:60 }}>
        <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>Submitted!</div>
        <div style={{ fontSize:14, color:"#666", marginBottom:28 }}>Your report has been sent to the manager for review.</div>
        <button onClick={reset} style={{ ...s.btn, background:"#f0f0f0", color:"#333", width:"auto", padding:"12px 32px" }}>Submit Another</button>
      </div>
    </div>
  )

  if (screen==="home") return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={{ fontSize:22 }}>🍳</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:17, fontWeight:800 }}>PawonLoka Staff</div>
          <div style={{ fontSize:12, opacity:0.85 }}>Hi, {staffName} 👋</div>
        </div>
        <button onClick={()=>{localStorage.removeItem("staff_name");setNameSet(false)}} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:8, padding:"5px 11px", fontSize:12, cursor:"pointer" }}>Change</button>
      </div>
      <div style={s.body}>
        <div style={{ fontSize:13, color:"#666", marginBottom:14, marginTop:4 }}>What do you want to report?</div>
        {[
          { screen:"opname",     icon:"📋", label:"Stock Count",       sub:"Count current stock levels",          bg:"#0066ff" },
          { screen:"waste",      icon:"🗑️", label:"Waste / Spoilage",  sub:"Report damaged or expired items",     bg:"#DE350B" },
          { screen:"production", icon:"🏭", label:"Production Batch",  sub:"Record what was produced today",       bg:"#00875A" },
        ].map(b=>(
          <div key={b.screen} style={s.card}>
            <button onClick={()=>setScreen(b.screen)} style={{ ...s.btn, background:b.bg, color:"#fff", marginBottom:0, textAlign:"left", display:"flex", alignItems:"center", gap:14, padding:"16px" }}>
              <span style={{ fontSize:28 }}>{b.icon}</span>
              <div>
                <div style={{ fontSize:16 }}>{b.label}</div>
                <div style={{ fontSize:12, fontWeight:400, opacity:0.85, marginTop:2 }}>{b.sub}</div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  if (screen==="opname") {
    const filtered = opnameCounts.filter(i=>!search||i.name.toLowerCase().includes(search.toLowerCase()))
    return (
      <div style={s.wrap}>
        <div style={s.header}>
          <button onClick={()=>setScreen("home")} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:0 }}>←</button>
          <span style={{ fontSize:17, fontWeight:800 }}>Stock Count</span>
        </div>
        <div style={s.body}>
          <div style={{ ...s.card, padding:"10px 12px", marginBottom:10 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search ingredient..." style={{ ...s.input, border:"none", padding:"6px 4px", fontSize:14 }} />
          </div>
          <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>Only fill items you counted. Leave blank to skip.</div>
          {filtered.map((item,idx)=>{
            const realIdx = opnameCounts.findIndex(x=>x.ingredient_id===item.ingredient_id)
            return (
              <div key={item.ingredient_id} style={{ ...s.card, padding:"11px 14px", display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>System: {fmt(item.system_qty)} {item.unit}</div>
                </div>
                <input type="number" inputMode="decimal" value={item.actual_qty} onChange={e=>setOpnameCounts(prev=>prev.map((x,i)=>i===realIdx?{...x,actual_qty:e.target.value}:x))} placeholder="—" style={{ ...s.input, width:76, textAlign:"center", padding:"9px 6px", fontSize:15, flexShrink:0 }} />
                <span style={{ fontSize:11, color:"#888", minWidth:22, flexShrink:0 }}>{item.unit}</span>
              </div>
            )
          })}
          <div style={{ height:80 }} />
          <div style={{ position:"fixed", bottom:0, left:0, right:0, padding:"12px 16px", background:"#fff", borderTop:"1px solid #eee", maxWidth:480, margin:"0 auto" }}>
            <button onClick={submitOpname} disabled={saving} style={{ ...s.btn, background:"#0066ff", color:"#fff", marginBottom:0 }}>{saving?"Submitting...":"✓ Submit Count"}</button>
          </div>
        </div>
      </div>
    )
  }

  if (screen==="waste") return (
    <div style={s.wrap}>
      <div style={s.header}>
        <button onClick={()=>setScreen("home")} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:0 }}>←</button>
        <span style={{ fontSize:17, fontWeight:800 }}>Waste / Spoilage</span>
      </div>
      <div style={s.body}>
        <div style={s.card}>
          <label style={s.label}>Ingredient *</label>
          <select value={wasteForm.ingredient_id} onChange={e=>setWasteForm(f=>({...f,ingredient_id:e.target.value}))} style={s.input}>
            <option value="">— Select ingredient —</option>
            {ingredients.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
          <label style={{ ...s.label, marginTop:14 }}>Quantity *</label>
          <input type="number" inputMode="decimal" value={wasteForm.qty} onChange={e=>setWasteForm(f=>({...f,qty:e.target.value}))} style={s.input} placeholder="0" />
          {wasteForm.ingredient_id && wasteForm.qty && (
            <div style={{ marginTop:8, padding:"9px 13px", background:"#fff0ed", borderRadius:10, fontSize:13, color:"#DE350B", fontWeight:700 }}>
              Est. Loss: Rp {fmt((parseFloat(wasteForm.qty)||0)*(ingredients.find(i=>i.id===wasteForm.ingredient_id)?.cost_per_unit||0))}
            </div>
          )}
          <label style={{ ...s.label, marginTop:14 }}>Reason *</label>
          <select value={wasteForm.reason} onChange={e=>setWasteForm(f=>({...f,reason:e.target.value}))} style={s.input}>
            {REASONS.map(r=><option key={r}>{r}</option>)}
          </select>
          <label style={{ ...s.label, marginTop:14 }}>Notes</label>
          <input value={wasteForm.notes} onChange={e=>setWasteForm(f=>({...f,notes:e.target.value}))} style={s.input} placeholder="Optional" />
        </div>
        <button onClick={submitWaste} disabled={saving} style={{ ...s.btn, background:"#DE350B", color:"#fff" }}>{saving?"Submitting...":"✓ Submit Waste Report"}</button>
      </div>
    </div>
  )

  if (screen==="production") return (
    <div style={s.wrap}>
      <div style={s.header}>
        <button onClick={()=>setScreen("home")} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:0 }}>←</button>
        <span style={{ fontSize:17, fontWeight:800 }}>Production Batch</span>
      </div>
      <div style={s.body}>
        <div style={s.card}>
          <label style={s.label}>Item Produced *</label>
          <select value={prodForm.item_id} onChange={e=>{ const ing=ingredients.find(i=>i.id===e.target.value); setProdForm(f=>({...f,item_id:e.target.value,unit:ing?.unit||""})) }} style={s.input}>
            <option value="">— Select item —</option>
            {ingredients.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <div style={{ flex:1 }}>
              <label style={s.label}>Quantity *</label>
              <input type="number" inputMode="decimal" value={prodForm.batch_qty} onChange={e=>setProdForm(f=>({...f,batch_qty:e.target.value}))} style={s.input} placeholder="0" />
            </div>
            <div style={{ width:90 }}>
              <label style={s.label}>Unit</label>
              <input value={prodForm.unit} onChange={e=>setProdForm(f=>({...f,unit:e.target.value}))} style={s.input} placeholder="gr" />
            </div>
          </div>
        </div>
        <div style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:700 }}>Ingredients Used *</div>
            <button onClick={()=>setProdUsed(u=>[...u,{ingredient_id:"",qty:"",unit:""}])} style={{ background:"#f0f0f0", border:"none", borderRadius:8, padding:"5px 12px", fontSize:13, cursor:"pointer", fontWeight:600 }}>+ Add</button>
          </div>
          {prodUsed.map((u,i)=>(
            <div key={i} style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
              <select value={u.ingredient_id} onChange={e=>{ const ing=ingredients.find(x=>x.id===e.target.value); setProdUsed(prev=>prev.map((x,idx)=>idx===i?{...x,ingredient_id:e.target.value,unit:ing?.unit||""}:x)) }} style={{ ...s.input, flex:2, fontSize:13 }}>
                <option value="">— Select —</option>
                {ingredients.map(ing=><option key={ing.id} value={ing.id}>{ing.name}</option>)}
              </select>
              <input type="number" inputMode="decimal" value={u.qty} onChange={e=>setProdUsed(prev=>prev.map((x,idx)=>idx===i?{...x,qty:e.target.value}:x))} style={{ ...s.input, width:70, fontSize:14 }} placeholder="Qty" />
              <span style={{ fontSize:11, color:"#888", minWidth:24 }}>{u.unit}</span>
              <button onClick={()=>setProdUsed(prev=>prev.filter((_,idx)=>idx!==i))} style={{ background:"none", border:"none", color:"#DE350B", fontSize:20, cursor:"pointer", padding:0 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={s.card}>
          <label style={s.label}>Notes</label>
          <input value={prodForm.notes} onChange={e=>setProdForm(f=>({...f,notes:e.target.value}))} style={s.input} placeholder="Optional" />
        </div>
        <button onClick={submitProduction} disabled={saving} style={{ ...s.btn, background:"#00875A", color:"#fff" }}>{saving?"Submitting...":"✓ Submit Production"}</button>
      </div>
    </div>
  )

  return null
}
