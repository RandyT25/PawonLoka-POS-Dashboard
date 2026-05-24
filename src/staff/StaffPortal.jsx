import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabase"

function fmt(n) { return Number(n||0).toLocaleString("id-ID") }
const REASONS = ["Expired","Damaged","Overproduction","Spillage","Other"]
const STAFF_LIST = ["Aisyah","Mahes","Alin","Meldy","Nita","Oji","Yudi","Claudy"]
const DEPARTMENTS = ["Bar","Kitchen","Kasir","All"]

function SearchableSelect({ options, value, onChange, placeholder, labelKey="name", valueKey="id" }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef(null)
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const selected = options.find(o => (o[valueKey]||o) === value)
  const filtered = options.filter(o => {
    const label = o[labelKey] || o
    return !search || label.toLowerCase().includes(search.toLowerCase())
  })
  const s = {
    wrap: { position:"relative" },
    trigger: { width:"100%", padding:"11px 13px", border:"1.5px solid #e0e0e0", borderRadius:10, fontSize:15, boxSizing:"border-box", fontFamily:"inherit", background:"#fff", textAlign:"left", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" },
    dropdown: { position:"absolute", zIndex:9999, top:"100%", left:0, right:0, background:"#fff", border:"1.5px solid #0066ff", borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", marginTop:2, overflow:"hidden" },
    search: { width:"100%", padding:"10px 12px", border:"none", borderBottom:"1px solid #eee", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" },
    list: { maxHeight:200, overflowY:"auto" },
    item: { padding:"10px 14px", fontSize:14, cursor:"pointer" },
  }
  return (
    <div ref={ref} style={s.wrap}>
      <button type="button" onClick={()=>{setOpen(o=>!o);setSearch("")}} style={s.trigger}>
        <span style={{ color: value ? "#111" : "#999" }}>{selected ? (selected[labelKey]||selected) : placeholder}</span>
        <span style={{ fontSize:10, color:"#999" }}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={s.dropdown}>
          <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={s.search} onClick={e=>e.stopPropagation()} />
          <div style={s.list}>
            {filtered.length===0 ? <div style={{ ...s.item, color:"#999" }}>No results</div>
              : filtered.map((o,i) => {
                const label = o[labelKey]||o; const val = o[valueKey]||o
                return <div key={i} onClick={()=>{onChange(val);setOpen(false);setSearch("")}} style={{ ...s.item, background:val===value?"#f0f5ff":"transparent", fontWeight:val===value?700:400, color:val===value?"#0066ff":"#111" }}>{label}</div>
              })
            }
          </div>
        </div>
      )}
    </div>
  )
}

export default function StaffPortal() {
  const [screen,       setScreen]       = useState("home")
  const [ingredients,  setIngredients]  = useState([])
  const [subRecipes,   setSubRecipes]   = useState([])
  const [subRecipeIngs,setSubRecipeIngs]= useState([])
  const [staffName,    setStaffName]    = useState(localStorage.getItem("staff_name")||"")
  const [nameSet,      setNameSet]      = useState(!!localStorage.getItem("staff_name"))
  const [saving,       setSaving]       = useState(false)
  const [done,         setDone]         = useState(false)
  const [opnameCounts, setOpnameCounts] = useState([])
  const [opnameSearch, setOpnameSearch] = useState("")
  const [todayAtt,    setTodayAtt]    = useState(null)
  const [clockPhoto,  setClockPhoto]  = useState(null)
  const [clockAction, setClockAction] = useState("in") // in | out
  const [clockSaving, setClockSaving] = useState(false)
  const [schedule,    setSchedule]    = useState(null)
  const [wasteForm,    setWasteForm]    = useState({ ingredient_id:"", qty:"", reason:"Expired", notes:"" })
  const [prodSubId,    setProdSubId]    = useState("")
  const [prodBatchQty, setProdBatchQty] = useState("")
  const [prodYield,    setProdYield]    = useState("")
  const [prodYieldUnit,setProdYieldUnit]= useState("")
  const [prodUsed,     setProdUsed]     = useState([])
  const [prodNotes,    setProdNotes]    = useState("")
  const [reqDept,      setReqDept]      = useState("")
  const [reqDate,      setReqDate]      = useState(new Date().toISOString().slice(0,10))
  const [reqNotes,     setReqNotes]     = useState("")
  const [reqItems,     setReqItems]     = useState([{ ingredient_id:"", qty:"", unit:"" }])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    // Load schedule and today's attendance
    const today = new Date().toISOString().slice(0,10)
    const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()]
    const [{ data:sched }, { data:att }] = await Promise.all([
      supabase.from("schedules").select("*").eq("id","weekly-template").single(),
      supabase.from("attendance").select("*").eq("date",today).eq("staff_name",localStorage.getItem("staff_name")||"").maybeSingle(),
    ])
    if (sched) setSchedule({ ...sched, todayDay:dayName, todayData:sched.days?.[dayName]||{} })
    setTodayAtt(att)
    setClockAction(att?.clock_in && !att?.clock_out ? "out" : "in")
    const [{ data:ings }, { data:subs }, { data:subIngs }] = await Promise.all([
      supabase.from("ingredients").select("id,name,unit,stock,cost_per_unit,supplier").order("name"),
      supabase.from("sub_recipes").select("*").order("name"),
      supabase.from("sub_recipe_ingredients").select("*"),
    ])
    setIngredients(ings||[])
    setSubRecipes(subs||[])
    setSubRecipeIngs(subIngs||[])
    setOpnameCounts((ings||[]).map(i=>({ ingredient_id:i.id, name:i.name, unit:i.unit, system_qty:i.stock||0, actual_qty:"" })))
  }

  function selectSubRecipe(subId) {
    setProdSubId(subId)
    if (!subId) { setProdUsed([]); return }
    const sub = subRecipes.find(s=>s.id===subId)
    if (sub) { setProdYield(sub.yield_qty||""); setProdYieldUnit(sub.yield_unit||sub.unit||"gr") }
    const lines = subRecipeIngs.filter(l=>l.sub_recipe_id===subId)
    if (lines.length) {
      setProdUsed(lines.map(l=>{ const ing=ingredients.find(i=>i.id===l.ingredient_id); return { ingredient_id:l.ingredient_id, name:ing?.name||"", qty:String(l.qty), unit:l.unit||ing?.unit||"" } }))
    } else {
      setProdUsed([{ ingredient_id:"", qty:"", unit:"" }])
    }
  }

  function saveName(name) {
    const n = name || staffName
    if (!n.trim()) return
    localStorage.setItem("staff_name", n.trim())
    setStaffName(n.trim())
    setNameSet(true)
  }

  async function submit(type, data) {
    setSaving(true)
    await supabase.from("staff_submissions").insert({
      id:"SS-"+Date.now(), type, status:"pending",
      submitted_by:staffName, submitted_at:new Date().toISOString(), data
    })
    setSaving(false); setDone(true)
  }

  async function submitOpname() {
    const filled = opnameCounts.filter(i=>i.actual_qty!=="")
    if (!filled.length) { alert("Enter at least one count"); return }
    await submit("opname", { items:filled.map(i=>({ ...i, actual_qty:parseFloat(i.actual_qty)||0, diff:(parseFloat(i.actual_qty)||0)-i.system_qty })) })
  }

  async function submitWaste() {
    const ing = ingredients.find(i=>i.id===wasteForm.ingredient_id)
    if (!ing||!wasteForm.qty) { alert("Select ingredient and quantity"); return }
    await submit("waste", { ingredient_id:ing.id, ingredient_name:ing.name, qty:parseFloat(wasteForm.qty), unit:ing.unit, reason:wasteForm.reason, notes:wasteForm.notes, estimated_cost:(parseFloat(wasteForm.qty)||0)*(ing.cost_per_unit||0) })
  }

  async function submitProduction() {
    if (!prodBatchQty) { alert("Enter batch quantity"); return }
    const validUsed = prodUsed.filter(u=>u.ingredient_id&&parseFloat(u.qty)>0)
    if (!validUsed.length) { alert("Add ingredients used"); return }
    const sub = subRecipes.find(s=>s.id===prodSubId)
    const isNewRecipe = !prodSubId
    await submit("production", {
      sub_recipe_id: prodSubId||null,
      item_name: sub?.name||"Custom Production",
      batch_qty: parseFloat(prodBatchQty),
      actual_yield: parseFloat(prodYield)||parseFloat(prodBatchQty),
      yield_unit: prodYieldUnit,
      notes: prodNotes+(isNewRecipe?" [NEW RECIPE - needs review]":""),
      needs_recipe_review: isNewRecipe,
      ingredients_used: validUsed.map(u=>({ ingredient_id:u.ingredient_id, name:u.name||ingredients.find(i=>i.id===u.ingredient_id)?.name||"", qty:parseFloat(u.qty), unit:u.unit }))
    })
  }

  async function submitRequisition() {
    const valid = reqItems.filter(i=>i.ingredient_id&&parseFloat(i.qty)>0)
    if (!valid.length) { alert("Add at least one item"); return }
    if (!reqDept) { alert("Select department"); return }
    await submit("requisition", {
      department: reqDept, needed_by: reqDate, notes: reqNotes,
      items: valid.map(i=>{ const ing=ingredients.find(x=>x.id===i.ingredient_id); return { ingredient_id:i.ingredient_id, ingredient_name:ing?.name||"", qty:parseFloat(i.qty), unit:i.unit||ing?.unit||"", supplier:ing?.supplier||"" } })
    })
  }

  function reset() {
    setDone(false); setScreen("home"); setOpnameSearch("")
    setWasteForm({ ingredient_id:"", qty:"", reason:"Expired", notes:"" })
    setProdSubId(""); setProdBatchQty(""); setProdYield(""); setProdYieldUnit(""); setProdUsed([]); setProdNotes("")
    setReqDept(""); setReqDate(new Date().toISOString().slice(0,10)); setReqNotes(""); setReqItems([{ ingredient_id:"", qty:"", unit:"" }])
  }

  const s = {
    wrap:{ height:"100dvh", display:"flex", flexDirection:"column", background:"#f5f6fa", fontFamily:"system-ui,sans-serif", fontSize:15, overflow:"hidden" },
    header:{ background:"#1a1a2e", color:"#fff", padding:"12px 18px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 },
    body:{ flex:1, overflowY:"auto", overflowX:"hidden", WebkitOverflowScrolling:"touch", padding:"14px 16px", maxWidth:480, margin:"0 auto", paddingBottom:120 },
    card:{ background:"#fff", borderRadius:14, padding:16, marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,0.06)" },
    label:{ fontSize:12, fontWeight:700, color:"#666", marginBottom:6, display:"block", textTransform:"uppercase", letterSpacing:"0.4px" },
    input:{ width:"100%", padding:"11px 13px", border:"1.5px solid #e0e0e0", borderRadius:10, fontSize:15, boxSizing:"border-box", fontFamily:"inherit", outline:"none" },
    btn:{ width:"100%", padding:"14px", borderRadius:12, border:"none", fontSize:15, fontWeight:700, cursor:"pointer", marginBottom:8, fontFamily:"inherit" },
    backBtn:{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:0, lineHeight:1 },
    fixedBottom:{ position:"fixed", bottom:0, left:0, right:0, padding:"12px 16px", background:"#fff", borderTop:"1px solid #eee", zIndex:10 },
  }

  const Logo = () => (
    <img src="/logo.png" alt="PawonLoka" style={{ height:36, width:36, borderRadius:8, objectFit:"cover" }} />
  )

  if (!nameSet) return (
    <div style={s.wrap}>
      <div style={s.header}><Logo /><span style={{ fontSize:17, fontWeight:800 }}>PawonLoka Staff</span></div>
      <div style={s.body}>
        <div style={{ ...s.card, marginTop:32 }}>
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <img src="/logo.png" alt="PawonLoka" style={{ width:80, height:80, borderRadius:16, objectFit:"cover", marginBottom:12 }} />
            <div style={{ fontSize:18, fontWeight:800 }}>Who are you?</div>
            <div style={{ fontSize:13, color:"#888", marginTop:4 }}>Select your name to continue</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {STAFF_LIST.map(name=>(
              <button key={name} onClick={()=>saveName(name)} style={{ ...s.btn, background:"#f5f0eb", color:"#5C3A1E", border:"2px solid #e8ddd0", marginBottom:0, padding:"14px 10px", fontSize:14, fontWeight:700, borderRadius:12 }}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  if (done) return (
    <div style={s.wrap}>
      <div style={s.header}><Logo /><span style={{ fontSize:17, fontWeight:800 }}>PawonLoka Staff</span></div>
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
        <Logo />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:17, fontWeight:800 }}>PawonLoka Staff</div>
          <div style={{ fontSize:12, opacity:0.85 }}>Hi, {staffName} 👋</div>
        </div>
        <button onClick={()=>{localStorage.removeItem("staff_name");setNameSet(false)}} style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:8, padding:"5px 11px", fontSize:12, cursor:"pointer" }}>Change</button>
      </div>
      <div style={s.body}>
        <div style={{ fontSize:13, color:"#888", marginBottom:14, marginTop:4 }}>What do you want to report?</div>
        {[
          { screen:"opname",      icon:"📋", label:"Stock Count",         sub:"Count current stock levels",          bg:"#0066ff" },
          { screen:"waste",       icon:"🗑️", label:"Waste / Spoilage",    sub:"Report damaged or expired items",     bg:"#DE350B" },
          { screen:"production",  icon:"🏭", label:"Production Batch",    sub:"Record what was produced today",       bg:"#00875A" },
          { screen:"requisition", icon:"🛒", label:"Request Ingredients", sub:"Request items needed for today",      bg:"#374151" },
          { screen:"clockin",     icon:"👆", label:"Clock In / Out",       sub:"Record your attendance with selfie",   bg:"#0f766e" },
        ].map(b=>(
          <div key={b.screen} style={{ ...s.card, padding:0, overflow:"hidden" }}>
            <button onClick={()=>setScreen(b.screen)} style={{ ...s.btn, background:b.bg, color:"#fff", marginBottom:0, textAlign:"left", display:"flex", alignItems:"center", gap:14, padding:"18px 16px", borderRadius:0 }}>
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
    const filteredOp = opnameCounts.filter(i=>!opnameSearch||i.name.toLowerCase().includes(opnameSearch.toLowerCase()))
    const filledCount = opnameCounts.filter(i=>i.actual_qty!=="").length
    return (
      <div style={s.wrap}>
        <div style={s.header}>
          <button onClick={()=>setScreen("home")} style={s.backBtn}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>Stock Count</div>
            <div style={{ fontSize:11, opacity:0.8 }}>{filledCount} items filled</div>
          </div>
        </div>
        <div style={s.body}>
          <div style={{ ...s.card, padding:"10px 12px", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>🔍</span>
            <input value={opnameSearch} onChange={e=>setOpnameSearch(e.target.value)} placeholder="Search ingredient..." style={{ ...s.input, border:"none", padding:"4px 0", fontSize:14, flex:1 }} />
            {opnameSearch && <button onClick={()=>setOpnameSearch("")} style={{ background:"none", border:"none", color:"#999", fontSize:18, cursor:"pointer", padding:0 }}>✕</button>}
          </div>
          <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>Only fill items you counted. Leave blank to skip.</div>
          {filteredOp.map((item)=>{
            const realIdx = opnameCounts.findIndex(x=>x.ingredient_id===item.ingredient_id)
            const filled = item.actual_qty !== ""
            return (
              <div key={item.ingredient_id} style={{ ...s.card, padding:"11px 14px", display:"flex", alignItems:"center", gap:10, marginBottom:8, borderLeft:`3px solid ${filled?"#00875A":"#e0e0e0"}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>System: {fmt(item.system_qty)} {item.unit}</div>
                </div>
                <input type="number" inputMode="decimal" value={item.actual_qty}
                  onChange={e=>setOpnameCounts(prev=>prev.map((x,i)=>i===realIdx?{...x,actual_qty:e.target.value}:x))}
                  placeholder="—" style={{ ...s.input, width:76, textAlign:"center", padding:"9px 6px", fontSize:15, flexShrink:0, background:filled?"#f0fff8":"#fafafa", borderColor:filled?"#00875A":"#e0e0e0" }} />
                <span style={{ fontSize:11, color:"#888", minWidth:24, flexShrink:0 }}>{item.unit}</span>
              </div>
            )
          })}
        </div>
        <div style={s.fixedBottom}>
          <div style={{ maxWidth:480, margin:"0 auto" }}>
            <button onClick={submitOpname} disabled={saving} style={{ ...s.btn, background:"#0066ff", color:"#fff", marginBottom:0 }}>{saving?"Submitting...":"✓ Submit Count"+(filledCount>0?` (${filledCount} items)`:"")}</button>
          </div>
        </div>
      </div>
    )
  }

  if (screen==="waste") return (
    <div style={s.wrap}>
      <div style={s.header}>
        <button onClick={()=>setScreen("home")} style={s.backBtn}>←</button>
        <span style={{ fontSize:17, fontWeight:800 }}>Waste / Spoilage</span>
      </div>
      <div style={s.body}>
        <div style={s.card}>
          <label style={s.label}>Ingredient *</label>
          <SearchableSelect options={ingredients} value={wasteForm.ingredient_id} onChange={v=>setWasteForm(f=>({...f,ingredient_id:v}))} placeholder="— Search ingredient —" />
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

  if (screen==="production") {
    const selectedSub = subRecipes.find(s=>s.id===prodSubId)
    return (
      <div style={s.wrap}>
        <div style={s.header}>
          <button onClick={()=>setScreen("home")} style={s.backBtn}>←</button>
          <span style={{ fontSize:17, fontWeight:800 }}>Production Batch</span>
        </div>
        <div style={s.body}>
          <div style={s.card}>
            <label style={s.label}>What are you producing?</label>
            <SearchableSelect
              options={[...subRecipes.map(s=>({id:s.id,name:s.name})), {id:"__custom__",name:"➕ Something not in the list..."}]}
              value={prodSubId} onChange={v=>{ if(v==="__custom__"){setProdSubId("");setProdUsed([{ingredient_id:"",qty:"",unit:"",name:""}])}else selectSubRecipe(v) }}
              placeholder="— Search sub-recipe —"
            />
            {selectedSub && (
              <div style={{ marginTop:8, padding:"8px 12px", background:"#f0fff8", borderRadius:8, fontSize:12, color:"#00875A", fontWeight:700 }}>
                ✓ Recipe loaded — {selectedSub.yield_qty} {selectedSub.yield_unit||"gr"} per batch
              </div>
            )}
          </div>

          <div style={s.card}>
            <label style={s.label}>Batch Quantity *</label>
            <div style={{ display:"flex", gap:10 }}>
              <input type="number" inputMode="decimal" value={prodBatchQty} onChange={e=>setProdBatchQty(e.target.value)} style={{ ...s.input, flex:1 }} placeholder="How many batches?" />
            </div>
            <label style={{ ...s.label, marginTop:14 }}>Actual Yield (Total Output)</label>
            <div style={{ display:"flex", gap:10 }}>
              <input type="number" inputMode="decimal" value={prodYield} onChange={e=>setProdYield(e.target.value)} style={{ ...s.input, flex:1 }} placeholder={selectedSub?.yield_qty||"e.g. 1500"} />
              <input value={prodYieldUnit} onChange={e=>setProdYieldUnit(e.target.value)} style={{ ...s.input, width:80 }} placeholder="gr" />
            </div>
          </div>

          <div style={s.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>Ingredients Used *</div>
                {selectedSub && <div style={{ fontSize:11, color:"#888", marginTop:2 }}>Auto-filled from recipe. Adjust if needed.</div>}
              </div>
              <button onClick={()=>setProdUsed(u=>[...u,{ingredient_id:"",qty:"",unit:"",name:""}])} style={{ background:"#f0f0f0", border:"none", borderRadius:8, padding:"5px 12px", fontSize:13, cursor:"pointer", fontWeight:600 }}>+ Add</button>
            </div>
            {prodUsed.map((u,i)=>(
              <div key={i} style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
                <div style={{ flex:2 }}>
                  <SearchableSelect options={ingredients} value={u.ingredient_id} onChange={v=>{ const ing=ingredients.find(x=>x.id===v); setProdUsed(prev=>prev.map((x,idx)=>idx===i?{...x,ingredient_id:v,unit:ing?.unit||"",name:ing?.name||""}:x)) }} placeholder="— Ingredient —" />
                </div>
                <input type="number" inputMode="decimal" value={u.qty} onChange={e=>setProdUsed(prev=>prev.map((x,idx)=>idx===i?{...x,qty:e.target.value}:x))} style={{ ...s.input, width:70, fontSize:14 }} placeholder="Qty" />
                <span style={{ fontSize:11, color:"#888", minWidth:24 }}>{u.unit}</span>
                <button onClick={()=>setProdUsed(prev=>prev.filter((_,idx)=>idx!==i))} style={{ background:"none", border:"none", color:"#DE350B", fontSize:20, cursor:"pointer", padding:0 }}>✕</button>
              </div>
            ))}
            {prodUsed.length===0 && <div style={{ fontSize:13, color:"#999", textAlign:"center", padding:"12px 0" }}>Select a recipe above or add ingredients manually</div>}
          </div>

          <div style={s.card}>
            <label style={s.label}>Notes</label>
            <input value={prodNotes} onChange={e=>setProdNotes(e.target.value)} style={s.input} placeholder={!prodSubId?"Describe what you're making (for review)":"Optional notes"} />
          </div>

          {!prodSubId && (
            <div style={{ padding:"10px 14px", background:"#fff8e1", borderRadius:10, marginBottom:12, fontSize:12, color:"#8a6000" }}>
              ⚠️ No recipe selected — this will be sent for manager review before stock is updated.
            </div>
          )}

          <button onClick={submitProduction} disabled={saving} style={{ ...s.btn, background:"#00875A", color:"#fff" }}>{saving?"Submitting...":"✓ Submit Production"}</button>
        </div>
      </div>
    )
  }

  if (screen==="requisition") return (
    <div style={s.wrap}>
      <div style={s.header}>
        <button onClick={()=>setScreen("home")} style={s.backBtn}>←</button>
        <span style={{ fontSize:17, fontWeight:800 }}>Request Ingredients</span>
      </div>
      <div style={s.body}>
        <div style={s.card}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <div>
              <label style={s.label}>Department *</label>
              <select value={reqDept} onChange={e=>setReqDept(e.target.value)} style={s.input}>
                <option value="">— Select —</option>
                {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Needed By *</label>
              <input type="date" value={reqDate} onChange={e=>setReqDate(e.target.value)} style={s.input} />
            </div>
          </div>
          <label style={s.label}>Notes</label>
          <input value={reqNotes} onChange={e=>setReqNotes(e.target.value)} style={s.input} placeholder="e.g. urgent, for dinner service..." />
        </div>

        <div style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:700 }}>Items Needed</div>
            <button onClick={()=>setReqItems(prev=>[...prev,{ingredient_id:"",qty:"",unit:""}])} style={{ background:"#374151", border:"none", borderRadius:8, padding:"6px 14px", fontSize:13, cursor:"pointer", fontWeight:700, color:"#fff" }}>+ Add Item</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"40px 1fr 70px 60px 28px", gap:6, marginBottom:8 }}>
            {["#","INGREDIENT","QTY","UNIT",""].map((h,i)=><div key={i} style={{ fontSize:10, fontWeight:700, color:"#999", textTransform:"uppercase" }}>{h}</div>)}
          </div>
          {reqItems.map((item,i)=>(
            <div key={i} style={{ display:"grid", gridTemplateColumns:"40px 1fr 70px 60px 28px", gap:6, marginBottom:10, alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#999", textAlign:"center" }}>{i+1}</div>
              <SearchableSelect options={ingredients} value={item.ingredient_id} onChange={v=>{ const ing=ingredients.find(x=>x.id===v); setReqItems(prev=>prev.map((x,idx)=>idx===i?{...x,ingredient_id:v,unit:ing?.unit||""}:x)) }} placeholder="Search..." />
              <input type="number" inputMode="decimal" value={item.qty} onChange={e=>setReqItems(prev=>prev.map((x,idx)=>idx===i?{...x,qty:e.target.value}:x))} style={{ ...s.input, padding:"10px 8px", fontSize:14, textAlign:"center" }} placeholder="0" />
              <input value={item.unit} onChange={e=>setReqItems(prev=>prev.map((x,idx)=>idx===i?{...x,unit:e.target.value}:x))} style={{ ...s.input, padding:"10px 6px", fontSize:13, textAlign:"center" }} placeholder="kg" />
              {reqItems.length>1 ? <button onClick={()=>setReqItems(prev=>prev.filter((_,idx)=>idx!==i))} style={{ background:"none", border:"none", color:"#DE350B", fontSize:18, cursor:"pointer", padding:0 }}>✕</button> : <div/>}
            </div>
          ))}
        </div>

        <button onClick={submitRequisition} disabled={saving||!reqDept} style={{ ...s.btn, background:"#374151", color:"#fff" }}>{saving?"Submitting...":"✓ Submit Request"}</button>
      </div>
    </div>
  )

  if (screen==="clockin") {
    const STATIONS = ["Kasir","Bar","Bakar","Snack","Kitchen"]
    const myStation = schedule ? STATIONS.find(s=>(schedule.todayData[s]||[]).includes(staffName)) : null
    const isOff = (schedule?.todayData?.off||[]).includes(staffName)
    const alreadyIn = todayAtt?.clock_in
    const alreadyOut = todayAtt?.clock_out
    const shiftStart = schedule?.shift_start||"08:00"

    async function doClockAction() {
      setClockSaving(true)
      const now = new Date()
      const todayStr = now.toISOString().slice(0,10)
      const attId = "ATT-"+staffName.replace(/\s/g,"")+"-"+todayStr

      // Check if late
      const [sh,sm] = shiftStart.split(":").map(Number)
      const shiftMs = (sh*60+sm)*60000
      const nowMs = (now.getHours()*60+now.getMinutes())*60000
      const status = clockAction==="in" ? (nowMs > shiftMs+10*60000 ? "late" : "on_time") : "done"

      let photoUrl = null
      if (clockPhoto) {
        // Upload photo to Supabase storage
        const blob = await fetch(clockPhoto).then(r=>r.blob())
        const fname = attId+"-"+clockAction+".jpg"
        const { data:up } = await supabase.storage.from("attendance-photos").upload(fname, blob, { upsert:true, contentType:"image/jpeg" })
        if (up) {
          const { data:pub } = supabase.storage.from("attendance-photos").getPublicUrl(fname)
          photoUrl = pub?.publicUrl
        }
      }

      if (clockAction==="in") {
        await supabase.from("attendance").upsert({
          id:attId, staff_name:staffName, date:todayStr,
          clock_in:now.toISOString(), scheduled_station:myStation||null,
          clock_in_photo:photoUrl, status
        }, { onConflict:"id" })
      } else {
        await supabase.from("attendance").update({
          clock_out:now.toISOString(), clock_out_photo:photoUrl
        }).eq("id",attId)
      }

      setClockPhoto(null)
      await loadData()
      setClockSaving(false)
      setDone(true)
    }

    return (
      <div style={s.wrap}>
        <div style={s.header}>
          <button onClick={()=>setScreen("home")} style={s.backBtn}>←</button>
          <span style={{ fontSize:17, fontWeight:800 }}>Clock {clockAction==="in"?"In":"Out"}</span>
        </div>
        <div style={s.body}>
          {isOff ? (
            <div style={{ ...s.card, textAlign:"center", padding:32 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🏖️</div>
              <div style={{ fontSize:16, fontWeight:800 }}>You're OFF today</div>
              <div style={{ fontSize:13, color:"#888", marginTop:6 }}>Enjoy your day off, {staffName}!</div>
            </div>
          ) : (
            <>
              <div style={s.card}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800 }}>{staffName}</div>
                    <div style={{ fontSize:12, color:myStation?"#0f766e":"#888", fontWeight:600 }}>
                      {myStation?"Station: "+myStation:"Not assigned to station"}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", fontSize:13, fontWeight:700 }}>
                    <div>{new Date().toLocaleDateString("id-ID",{weekday:"long"})}</div>
                    <div style={{ fontSize:11, color:"#888" }}>Shift {shiftStart}</div>
                  </div>
                </div>
                {alreadyIn && (
                  <div style={{ padding:"8px 12px", background:"#f0fdf4", borderRadius:8, fontSize:12, color:"#065f46", fontWeight:600 }}>
                    Clocked in at {new Date(todayAtt.clock_in).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}
                    {alreadyOut && ` · Out at ${new Date(todayAtt.clock_out).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}`}
                  </div>
                )}
              </div>

              {!alreadyOut && (
                <div style={s.card}>
                  <label style={{ ...s.label, marginBottom:8 }}>Take Selfie {clockAction==="in"?"(Clock In)":"(Clock Out)"}</label>
                  {clockPhoto ? (
                    <div style={{ position:"relative" }}>
                      <img src={clockPhoto} style={{ width:"100%", borderRadius:10, maxHeight:280, objectFit:"cover" }} />
                      <button onClick={()=>setClockPhoto(null)} style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.6)", border:"none", color:"#fff", borderRadius:20, padding:"4px 10px", cursor:"pointer", fontSize:12 }}>Retake</button>
                    </div>
                  ) : (
                    <label style={{ display:"block", cursor:"pointer" }}>
                      <div style={{ border:"2px dashed #ccc", borderRadius:10, padding:32, textAlign:"center", background:"#fafafa" }}>
                        <div style={{ fontSize:40, marginBottom:8 }}>📸</div>
                        <div style={{ fontSize:14, fontWeight:600, color:"#666" }}>Tap to take selfie</div>
                        <div style={{ fontSize:12, color:"#999", marginTop:4 }}>Camera will open</div>
                      </div>
                      <input type="file" accept="image/*;capture=camera" capture="user" style={{ display:"none" }}
                        onChange={e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=ev=>setClockPhoto(ev.target.result); r.readAsDataURL(f) } }} />
                    </label>
                  )}
                </div>
              )}

              {alreadyOut ? (
                <div style={{ ...s.card, textAlign:"center" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                  <div style={{ fontSize:15, fontWeight:800 }}>Attendance complete for today</div>
                  <div style={{ fontSize:12, color:"#888", marginTop:4 }}>See you tomorrow!</div>
                </div>
              ) : (
                <button onClick={doClockAction} disabled={clockSaving}
                  style={{ ...s.btn, background:clockAction==="in"?"#0f766e":"#b91c1c", color:"#fff" }}>
                  {clockSaving?"Saving...":`👆 Clock ${clockAction==="in"?"In":"Out"} Now`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}
