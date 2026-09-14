import { useState, useEffect, useRef, useMemo } from "react"
import Login from "./components/Login.jsx"
import Attendance from "./components/Attendance.jsx"
import ProductionForm from "./components/ProductionForm.jsx"
import RequisitionForm from "./components/RequisitionForm.jsx"
import TrialForm from "./components/TrialForm.jsx"
import OpnameForm from "./components/OpnameForm.jsx"
import WasteForm from "./components/WasteForm.jsx"
import ConsumptionForm from "./components/ConsumptionForm.jsx"
import { supabase } from "../lib/supabase"
import { offlineStore } from "../lib/offlineStore"

function fmt(n) { return Number(n||0).toLocaleString("id-ID") }

// Convert a qty expressed in `unit` into the ingredient's own base/stock unit
function toBaseUnit(ing, qty, unit) {
  if (!ing || unit === ing.unit) return qty
  const conv = (ing.conversions||[]).find(c => c.unit === unit)
  if (conv && parseNum(conv.qty) > 0) return qty * parseNum(conv.qty)
  const fallbacks = { kg:1000, L:1000, Galon:19000 }
  if (ing.unit==="gr" && fallbacks[unit]) return qty * fallbacks[unit]
  if (ing.unit==="ml" && fallbacks[unit]) return qty * fallbacks[unit]
  return qty
}

// Default a newly-selected ingredient's unit to its biggest packaging size (largest
// conversions[].qty multiplier), not the raw base unit, since that's almost never what
// staff actually mean to select when they don't touch the unit dropdown.
function biggestUnit(ing) {
  if (!ing) return ""
  const convs = ing.conversions || []
  if (!convs.length) return ing.unit
  return convs.reduce((max, c) => (parseNum(c.qty)||0) > (parseNum(max.qty)||0) ? c : max, convs[0]).unit || ing.unit
}
const REASONS = ["Expired","Damaged","Overproduction","Spillage","Other"]

const parseNum = (v) => parseFloat(String(v).replace(",", ".")) || 0

const STATIONS = {
  Kitchen:    { color:"#00875A" },
  Snack:      { color:"#F59E0B" },
  Bar:        { color:"#3B82F6" },
  Kasir:      { color:"#6366F1" },
}

// Which Backoffice departments show up on each station's staff picker —
// Cook/Head Cook/Bakar all fold into the Kitchen screen, matching today's setup.
const STATION_DEPTS = {
  Kitchen: ["Kitchen","Cook","Head Cook","Bakar"],
  Snack:   ["Snack"],
  Bar:     ["Bar"],
  Kasir:   ["Kasir"],
}

const MENUS = {
  Kitchen: ["opname","waste","consumption","production","requisition","trial"],
  Snack:   ["opname","waste","consumption","production","requisition","trial"],
  Bar:     ["opname","waste","consumption","production","requisition","trial"],
  Kasir:   ["opname","waste","consumption","production","requisition","trial"],
}

const MENU_ITEMS = [
  { screen:"opname",      icon:"📋", label:"Stock Count",         sub:"Count current stock levels",        bg:"#0066ff" },
  { screen:"waste",       icon:"🗑️", label:"Waste / Spoilage",    sub:"Report damaged or expired items",   bg:"#DE350B" },
  { screen:"consumption", icon:"🍽️", label:"Staff Meal / Personal Use", sub:"Log food or drink you took for yourself", bg:"#F59E0B" },
  { screen:"production",  icon:"🏭", label:"Production Batch",    sub:"Record what was produced today",    bg:"#00875A" },
  { screen:"requisition", icon:"🛒", label:"Request Ingredients", sub:"Request items needed for today",    bg:"#374151" },
  { screen:"trial",       icon:"🧪", label:"Trial Menu / R&D",  sub:"Record testing new recipes or photoshoots", bg:"#6366F1" },
]

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
  const UOM_OPTIONS = ["kg", "gr", "L", "ml", "pcs", "pack", "ikat", "btg", "lbr", "porsi", "bks", "kaleng", "botol", "cup"]

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

function StaffPicker({ color, value, onChange, staffList }) {
  return (
    <div>
      <div style={{ fontSize:12, fontWeight:700, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Submitted By *</div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {staffList.map(name => (
          <button key={name} type="button" onClick={()=>onChange(name)}
            style={{ padding:"8px 18px", borderRadius:20, border:`2px solid ${value===name ? color : "#e0e0e0"}`,
              background: value===name ? color : "#fff",
              color: value===name ? "#fff" : "#333",
              fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function StaffPortal() {
  const [station,      setStation]      = useState(null)
  const [screen,       setScreen]       = useState("home")
  const [ingredients,  setIngredients]  = useState([])
  const [ingredientsById, setIngredientsById] = useState({})
  const [subRecipes,   setSubRecipes]   = useState([])
  const [subRecipeIngs,setSubRecipeIngs]= useState([])
  const [frozenProducts, setFrozenProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [frozenRecipes,  setFrozenRecipes]  = useState([])
  const [saving,       setSaving]       = useState(false)
  const [done,         setDone]         = useState(false)
  const [opnameCounts, setOpnameCounts] = useState([])
  const [opnameSearch, setOpnameSearch] = useState("")
  const [opnameDate,   setOpnameDate]   = useState(new Date().toISOString().slice(0,10))
  const [staffName,    setStaffName]    = useState("")
  const [loggedStaff, setLoggedStaff] = useState(null)
      const [wasteForm,    setWasteForm]    = useState({ ingredient_id:"", qty:"", unit:"", reason:"Expired", notes:"", date:new Date().toISOString().slice(0,10) })
  const [consumptionForm, setConsumptionForm] = useState({ ingredient_id:"", qty:"", unit:"", notes:"", date:new Date().toISOString().slice(0,10) })
  const [trialForm, setTrialForm] = useState({ trialName:"", notes:"", items:[{ingredient_id:"", qty:"", unit:""}] })
  const [prodType,     setProdType]     = useState("") // 'sub' | 'product'
  const [prodSubId,    setProdSubId]    = useState("")
  const [prodProductSku, setProdProductSku] = useState("")
  const [prodBatchQty, setProdBatchQty] = useState("")
  const [prodYield,    setProdYield]    = useState("")
  const [prodYieldUnit,setProdYieldUnit]= useState("")
  const [prodUsed,     setProdUsed]     = useState([])
  const [prodNotes,    setProdNotes]    = useState("")
  const [prodDate,     setProdDate]     = useState(new Date().toISOString().slice(0,10))
  const [reqDate,      setReqDate]      = useState(new Date().toISOString().slice(0,10))
  const [reqNotes,     setReqNotes]     = useState("")
  const [reqItems,     setReqItems]     = useState([{ ingredient_id:"", qty:"", unit:"" }])
  const [stationStaff, setStationStaff] = useState({})
  const [allStaff,     setAllStaff]     = useState([])

  // Use ingredient_id (not the sub_recipes row's own id) as the option value — that's the
  // id staff_submissions/stock_movements actually deduct against. See RecipeEditor.jsx's
  // `all` list for the same fix applied there.
  
  const isOwner = (staff) => {
    if (!staff) return false;
    const roles = Array.isArray(staff.role) ? staff.role : [];
    if (roles.some(r => typeof r === "string" && r.toLowerCase() === "owner")) return true;
    if (typeof staff.name === "string" && staff.name.toLowerCase().includes("claudy")) return true;
    return false;
  };

  const isNita = (staff) => {
    if (!staff) return false;
    return typeof staff.name === "string" && staff.name.toLowerCase().includes("nita");
  };

  // Memoize filters
  const filteredIngredients = useMemo(() => {
    if (isOwner(loggedStaff)) return ingredients;
    if (isNita(loggedStaff)) return ingredients; // Nita can request anything
    return ingredients.filter(i => {
      if (i.station && Array.isArray(i.station)) {
        return i.station.some(s => typeof s === "string" && s.toLowerCase() === (station || "").toLowerCase());
      } else if (i.station && typeof i.station === "string") {
        return i.station.toLowerCase() === (station || "").toLowerCase();
      }
      return true;
    });
  }, [ingredients, loggedStaff, station]);

  const filteredSubRecipes = useMemo(() => {
    if (isOwner(loggedStaff)) return subRecipes;
    return subRecipes.filter(r => {
      if (isNita(loggedStaff) && r.name.toLowerCase().includes("sambal kacang")) return true;
      const outIng = ingredients.find(i => i.id === r.ingredient_id);
      if (!outIng) return true;
      if (outIng.station && Array.isArray(outIng.station)) {
        return outIng.station.some(s => typeof s === "string" && s.toLowerCase() === (station || "").toLowerCase());
      } else if (outIng.station && typeof outIng.station === "string") {
        return outIng.station.toLowerCase() === (station || "").toLowerCase();
      }
      return true;
    });
  }, [subRecipes, ingredients, loggedStaff, station]);

  const filteredFrozenProducts = useMemo(() => {
    if (isOwner(loggedStaff)) return frozenProducts;
    if ((station||"").toLowerCase() === "kitchen") return frozenProducts;
    return [];
  }, [frozenProducts, loggedStaff, station]);

  const subRecipeOptions = filteredSubRecipes.map(s => {

    const ing = ingredientsById[s.ingredient_id]
    return { id: s.ingredient_id||s.id, name:s.name, unit: ing?.unit||s.yield_unit||s.unit||"gr", cost_per_unit: ing?.cost_per_unit||s.cost_per_unit||0 }
  })

  useEffect(() => { loadStaff(); loadData() }, [])
  useEffect(() => { if (station) loadData() }, [station])

  function buildStationStaff(rows) {
    const map = {}
    Object.keys(STATION_DEPTS).forEach(st => {
      map[st] = rows.filter(r => (r.role||[]).some(role => STATION_DEPTS[st].includes(role))).map(r=>r.name)
    })
    return map
  }

  function buildAllStaff(rows) { return rows.sort((a,b)=>a.name.localeCompare(b.name)) }

  async function loadStaff() {
    const cached = await offlineStore.getCache('staff')
    if (cached?.length) { setStationStaff(buildStationStaff(cached)); setAllStaff(buildAllStaff(cached)) }
    try {
      const { data } = await supabase.from("staff").select("id,name,role,pin,active").eq("active", true)
      if (data) { setStationStaff(buildStationStaff(data)); setAllStaff(buildAllStaff(data)); offlineStore.setCache('staff', data) }
    } catch { /* offline — cached already applied */ }
  }

  async function loadData() {
    // Load from cache immediately for offline startup
    const [cachedIngs, cachedSubs, cachedSubIngs, cachedFrozenProds, cachedAllProds, cachedFrozenRecipes] = await Promise.all([
      offlineStore.getCache('ingredients'),
      offlineStore.getCache('sub_recipes'),
      offlineStore.getCache('sub_recipe_ingredients'),
      offlineStore.getCache('frozen_products'),
      offlineStore.getCache('all_products'),
      offlineStore.getCache('recipes'),
    ])
    if (cachedIngs?.length)   { setIngredientsById(Object.fromEntries(cachedIngs.map(i=>[i.id,i]))); setIngredients(cachedIngs.filter(i => !i.name.includes("(sub)"))); setOpnameCounts(cachedIngs.map(i=>({ ingredient_id:i.id, name:i.name, unit:i.unit, conversions:i.conversions||[], input_unit:i.unit, system_qty:i.stock||0, actual_qty:"" }))) }
    if (cachedSubs?.length)   setSubRecipes(cachedSubs)
    if (cachedSubIngs?.length) setSubRecipeIngs(cachedSubIngs)
    if (cachedFrozenProds?.length) setFrozenProducts(cachedFrozenProds)
    if (cachedAllProds?.length) setAllProducts(cachedAllProds)
    if (cachedFrozenRecipes?.length) setFrozenRecipes(cachedFrozenRecipes)
    if ((stationStaff[station]||[]).length === 1) setStaffName(stationStaff[station][0])

    // Refresh from Supabase in background
    try {
      const [{ data:ings }, { data:subs }, { data:subIngs }, { data:frozenProds }, { data:allProds }, { data:allRecipes }] = await Promise.all([
        supabase.from("ingredients").select("id,name,unit,stock,cost_per_unit,supplier,station,conversions").order("name"),
        supabase.from("sub_recipes").select("*").order("name"),
        supabase.from("sub_recipe_ingredients").select("*"),
        supabase.from("products").select("sku,name,cat,price").eq("cat","Frozen Food").eq("active",true).order("name"),
        supabase.from("products").select("sku,name,cat").eq("active",true).order("name"),
        supabase.from("recipes").select("product_id,ingredient_id,qty,unit,ingredient_name"),
      ])
      if (ings)    { setIngredientsById(Object.fromEntries(ings.map(i=>[i.id,i]))); setIngredients(ings.filter(i => !i.name.includes("(sub)"))); setOpnameCounts(ings.map(i=>({ ingredient_id:i.id, name:i.name, unit:i.unit, conversions:i.conversions||[], input_unit:i.unit, system_qty:i.stock||0, actual_qty:"" }))); offlineStore.setCache('ingredients', ings) }
      if (subs)    { setSubRecipes(subs); offlineStore.setCache('sub_recipes', subs) }
      if (subIngs) { setSubRecipeIngs(subIngs); offlineStore.setCache('sub_recipe_ingredients', subIngs) }
      if (frozenProds) { setFrozenProducts(frozenProds); offlineStore.setCache('frozen_products', frozenProds) }
      if (allProds) { setAllProducts(allProds); offlineStore.setCache('all_products', allProds) }
      if (allRecipes)   { setFrozenRecipes(allRecipes); offlineStore.setCache('recipes', allRecipes) }
    } catch { /* offline — already loaded from cache */ }
  }

  function selectSubRecipe(subId) {
    setProdType("sub"); setProdProductSku("")
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

  // Frozen retail products (e.g. "Ayam Taliwang Frozen") produced/packed directly from a
  // prep ingredient via the same `recipes` link POS.jsx uses to cost/deduct at sale time —
  // see selectSubRecipe() above for the parallel sub-recipe path.
  function selectFrozenProduct(sku) {
    setProdType("product"); setProdSubId("")
    setProdProductSku(sku)
    if (!sku) { setProdUsed([]); return }
    const lines = frozenRecipes.filter(l=>l.product_id===sku)
    if (lines.length) {
      setProdUsed(lines.map(l=>{ const ing=ingredientsById[l.ingredient_id]; return { ingredient_id:l.ingredient_id, name:ing?.name||l.ingredient_name||"", qty:String(l.qty), unit:l.unit||ing?.unit||"" } }))
    } else {
      setProdUsed([{ ingredient_id:"", qty:"", unit:"" }])
    }
  }

  function selectProductionTarget(compositeId) {
    if (!compositeId) { setProdType(""); setProdSubId(""); setProdProductSku(""); setProdUsed([]); return }
    const sep = compositeId.indexOf(":")
    const type = compositeId.slice(0, sep)
    const id   = compositeId.slice(sep + 1)
    if (type === "prod") selectFrozenProduct(id)
    else selectSubRecipe(id)
  }

  async function submit(type, data) {
    if (!staffName) { alert("Please select who is submitting"); return }
    setSaving(true)
    const subId = "SS-" + Date.now();
    let isAutoAccept = false;
    if (type === "production") {
      const { data: settings } = await supabase.from('app_settings').select('pos_behaviour').eq('id', 'main').single();
      if (settings?.pos_behaviour?.auto_accept_production) {
        isAutoAccept = true;
      }
    }
    
    if (isAutoAccept) {
      // Auto accept logic for production
      try {
        const d = data;
        const outputIngredientId = d.item_id || subRecipes.find(sr=>sr.id===d.sub_recipe_id)?.ingredient_id;
        const item = outputIngredientId ? ingredientsById[outputIngredientId] : null;
        const producedQty = d.actual_yield ?? d.batch_qty;
        const producedDate = d.date || new Date().toISOString().slice(0,10);
        const movId = () => "MOV-" + Date.now() + "-" + Math.random().toString(36).slice(2,6);
        const nowTime = () => new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
        
        for (const u of d.ingredients_used||[]) {
          const ing = ingredients.find(i=>i.id===u.ingredient_id);
          if (!ing) continue;
          const qtyBase = toBaseUnit(ing, u.qty||0, u.unit);
          const { data:freshIng } = await supabase.from("ingredients").select("stock").eq("id",ing.id).maybeSingle();
          const newStock = Math.max(0, (freshIng?.stock ?? ing.stock ?? 0) - qtyBase);
          await supabase.from("ingredients").update({ stock:newStock }).eq("id",ing.id);
          await supabase.from("stock_movements").insert({
            id: movId(), type:"Production", ingredient_id:ing.id, ingredient_name:ing.name,
            qty:-qtyBase, unit:ing.unit, ref: subId,
            note:"Auto-approved production by "+staffName,
            date:producedDate, time:nowTime(),
          });
        }
        if (item) {
          const producedQtyBase = toBaseUnit(item, producedQty||0, d.yield_unit||d.unit||item.unit);
          const { data:freshItem } = await supabase.from("ingredients").select("stock").eq("id",item.id).maybeSingle();
          const newItemStock = (freshItem?.stock ?? item.stock ?? 0) + producedQtyBase;
          await supabase.from("ingredients").update({ stock:newItemStock }).eq("id",item.id);
          await supabase.from("stock_movements").insert({
            id: movId(), type:"Production", ingredient_id:item.id, ingredient_name:item.name,
            qty:producedQtyBase, unit:item.unit, ref: subId,
            note:"Auto-approved production output by "+staffName,
            date:producedDate, time:nowTime(),
          });
        }
      } catch (err) {
        console.error("Auto accept failed", err);
      }
    }
    if (!staffName) { alert("Please select who is submitting"); return }
    setSaving(true)
    const { error } = await supabase.from("staff_submissions").insert({
      id:subId, type, status: isAutoAccept ? "approved" : "pending",
      submitted_by: staffName,
      submitted_at: new Date().toISOString(),
      data: { ...data, station, submitted_by: staffName }
    })
    setSaving(false)
    if (error) { alert("Failed to submit report: "+error.message+"\n\nPlease try again or tell your manager."); return }
    setDone(true)
  }




  function reset(forceHome) {
    setDone(false); setScreen(forceHome || station ? "home" : "consumption"); setStaffName(""); setOpnameSearch("")
    setOpnameDate(new Date().toISOString().slice(0,10))
    setWasteForm({ ingredient_id:"", qty:"", reason:"Expired", notes:"", date:new Date().toISOString().slice(0,10) })
    setConsumptionForm({ ingredient_id:"", qty:"", notes:"", date:new Date().toISOString().slice(0,10) })
    setProdType(""); setProdSubId(""); setProdProductSku(""); setProdBatchQty(""); setProdYield(""); setProdYieldUnit(""); setProdUsed([]); setProdNotes("")
    setProdDate(new Date().toISOString().slice(0,10))
    setReqDate(new Date().toISOString().slice(0,10)); setReqNotes(""); setReqItems([{ ingredient_id:"", qty:"", unit:"" }])
    setTrialForm({ trialName:"", notes:"", items:[{ingredient_id:"", qty:"", unit:""}] })
    if ((stationStaff[station]||[]).length === 1) setStaffName(stationStaff[station][0])
  }

  const stationColor = station ? STATIONS[station].color : "#F59E0B"

  const UOM_OPTIONS = ["kg", "gr", "L", "ml", "pcs", "pack", "ikat", "btg", "lbr", "porsi", "bks", "kaleng", "botol", "cup"]

  const s = {
    wrap:{ height:"100dvh", display:"flex", flexDirection:"column", background:"#f5f6fa", fontFamily:"system-ui,sans-serif", fontSize:15, overflow:"hidden" },
    header:{ background: stationColor, color:"#fff", padding:"12px 18px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 },
    body:{ flex:1, overflowY:"auto", overflowX:"hidden", WebkitOverflowScrolling:"touch", padding:"14px 16px", maxWidth:480, margin:"0 auto", paddingBottom:120 },
    card:{ background:"#fff", borderRadius:14, padding:16, marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,0.06)" },
    label:{ fontSize:12, fontWeight:700, color:"#666", marginBottom:6, display:"block", textTransform:"uppercase", letterSpacing:"0.4px" },
    input:{ width:"100%", padding:"11px 13px", border:"1.5px solid #e0e0e0", borderRadius:10, fontSize:15, boxSizing:"border-box", fontFamily:"inherit", outline:"none" },
    btn:{ width:"100%", padding:"14px", borderRadius:12, border:"none", fontSize:15, fontWeight:700, cursor:"pointer", marginBottom:8, fontFamily:"inherit" },
    backBtn:{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:0, lineHeight:1 },
    fixedBottom:{ position:"fixed", bottom:0, left:0, right:0, padding:"12px 16px", background:"#fff", borderTop:"1px solid #eee", zIndex:10 },
  }

  const Logo = () => (
    <img src="/logo-staff.png" alt="PawonLoka" style={{ height:36, width:36, borderRadius:8, objectFit:"cover" }} />
  )

  
  if (!loggedStaff) {
    return <Login allStaff={allStaff.map(s=>s.name)} onLogin={(s) => {
       setLoggedStaff(s)
       setStaffName(s.name)
       const matchingStation = Object.keys(STATION_DEPTS).find(st => (s.role||[]).some(r => STATION_DEPTS[st].includes(r)))
       if (matchingStation) setStation(matchingStation)
    }} />
  }

  if (screen === "attendance") {
    return <Attendance staff={loggedStaff} onBack={() => setScreen("home")} />
  }

  // Station picker screen
  if (!station) return (
    <div style={s.wrap}>
      <datalist id="uom-options">{UOM_OPTIONS.map(u=><option key={u} value={u}/>)}</datalist>
      <div style={{ ...s.header, background:"#1a1a2e" }}><Logo /><span style={{ fontSize:17, fontWeight:800 }}>PawonLoka Staff</span></div>
      <div style={s.body}>
        <div style={{ ...s.card, marginTop:24 }}>
          <div style={{ textAlign:"center", marginBottom:24 }}>
            <img src="/logo-staff.png" alt="PawonLoka" style={{ width:72, height:72, borderRadius:14, objectFit:"cover", marginBottom:12 }} />
            <div style={{ fontSize:19, fontWeight:800 }}>Select Your Station</div>
            <div style={{ fontSize:13, color:"#888", marginTop:4 }}>Pick your station to continue</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:12 }}>
            {Object.entries(STATIONS).map(([name, cfg]) => (
              <button key={name} onClick={()=>setStation(name)}
                style={{ ...s.btn, background:cfg.color, color:"#fff", marginBottom:0, fontSize:17, letterSpacing:"0.3px", padding:"24px 16px", borderRadius:16 }}>
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
      <datalist id="uom-options">{UOM_OPTIONS.map(u=><option key={u} value={u}/>)}</datalist>
      <div style={s.header}><Logo /><span style={{ fontSize:17, fontWeight:800 }}>{station ? `${station} Station` : "PawonLoka Staff"}</span></div>
      <div style={{ ...s.body, textAlign:"center", paddingTop:60 }}>
        <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>Submitted!</div>
        <div style={{ fontSize:14, color:"#666", marginBottom:28 }}>Report sent to manager for review.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, maxWidth:280, margin:"0 auto" }}>
          <button onClick={()=>reset()} style={{ ...s.btn, background:stationColor, color:"#fff", marginBottom:0 }}>Submit Another</button>
          {(!station || isOwner(loggedStaff) || !Object.keys(STATION_DEPTS).some(st => ((loggedStaff?.role)||[]).some(r => STATION_DEPTS[st].includes(r)))) && (
    <button onClick={()=>{ reset(true); setStation(null) }} style={{ ...s.btn, background:"#f0f0f0", color:"#333", marginBottom:0 }}>{station ? "Change Station" : "Back to Menu"}</button>
  )}
        </div>
      </div>
    </div>
  )

  if (screen==="home") return (
    <div style={s.wrap}>
      <datalist id="uom-options">{UOM_OPTIONS.map(u=><option key={u} value={u}/>)}</datalist>
      <div style={s.header}>
        <Logo />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:17, fontWeight:800 }}>PawonLoka Staff</div>
          <div style={{ fontSize:12, opacity:0.85 }}>{station} Station</div>
        </div>
        {(isOwner(loggedStaff) || !Object.keys(STATION_DEPTS).some(st => ((loggedStaff?.role)||[]).some(r => STATION_DEPTS[st].includes(r)))) && (<button onClick={()=>setStation(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:8, padding:"5px 11px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Change</button>)}
      </div>
      <div style={s.body}>
        <div style={{ fontSize:13, color:"#888", marginBottom:14, marginTop:4, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Menu</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:12 }}>
          {[{screen:"attendance", icon:"🕒", label:"Attendance", sub:"Clock in / Clock out", bg:"#10B981"}, ...MENU_ITEMS.filter(m=>MENUS[station].includes(m.screen))].map(b=>(
            <button key={b.screen} onClick={()=>setScreen(b.screen)} 
              style={{ background:b.bg, border:"none", borderRadius:14, padding:"12px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", boxShadow:"0 4px 12px rgba(0,0,0,0.08)", transition:"transform 0.1s" }}>
              <div style={{ fontSize:26, background:"rgba(255,255,255,0.2)", width:46, height:46, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{b.icon}</div>
              <div style={{ textAlign:"left", flex:1 }}>
                <div style={{ fontSize:16, fontWeight:800, color:"#fff", marginBottom:2 }}>{b.label}</div>
                <div style={{ fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.9)", lineHeight:1.3 }}>{b.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  if (screen==="opname") {
    return <OpnameForm 
      ingredients={filteredIngredients}
      staff={loggedStaff}
      station={station} 
      stationColor={stationColor} 
      saving={saving}
      onBack={() => { setScreen(station ? "home" : "home"); setOpnameSearch("") }}
      onSubmit={async (data) => {
         const items = data.items.map(i => {
           const enteredQty = parseNum(i.actual_qty)||0
           const ing = ingredients.find(x=>x.id===i.ingredient_id)
           const actual_qty = toBaseUnit(ing, enteredQty, i.input_unit)
           return { ...i, entered_qty: enteredQty, entered_unit: i.input_unit, actual_qty, diff: actual_qty - i.system_qty }
         })
         await submit("opname", { items }, data.date)
      }} 
    />
  }

  
  if (screen==="waste") {
    return <WasteForm 
      ingredients={filteredIngredients} subRecipes={subRecipeOptions} 
      onBack={() => setScreen("home")} 
      onSubmit={async (payload) => {
        const ing = ingredientsById[payload.ingredient_id]
        const enteredQty = parseNum(payload.qty)
        const qtyInBase = toBaseUnit(ing, enteredQty, payload.unit)
        if (qtyInBase <= 0) { alert("Quantity must be greater than 0"); return }
        
        await submit("waste", {
          ingredient_id: payload.ingredient_id,
          ingredient_name: ing?.name,
          entered_qty: enteredQty,
          entered_unit: payload.unit,
          qty: qtyInBase,
          unit: ing?.unit,
          reason: payload.reason,
          notes: enteredQty + " " + payload.unit + " — " + payload.notes,
          date: payload.date,
          estimated_cost: qtyInBase * (ing?.cost_per_unit || 0),
          staff_name: loggedStaff.name,
          station
        })
        setScreen("home")
      }}
      saving={saving} stationColor={stationColor} 
    />
  }


  if (screen==="consumption") {
    return <ConsumptionForm 
      ingredients={filteredIngredients} subRecipes={subRecipeOptions} 
      onBack={() => setScreen("home")} 
      onSubmit={async (payload) => {
        const ing = ingredientsById[payload.ingredient_id]
        const enteredQty = parseNum(payload.qty)
        const qtyInBase = toBaseUnit(ing, enteredQty, payload.unit)
        if (qtyInBase <= 0) { alert("Quantity must be greater than 0"); return }
        
        await submit("consumption", {
          ingredient_id: payload.ingredient_id,
          ingredient_name: ing?.name,
          entered_qty: enteredQty,
          entered_unit: payload.unit,
          qty: qtyInBase,
          unit: ing?.unit,
          notes: enteredQty + " " + payload.unit + " (Staff Meal)",
          date: payload.date,
          estimated_cost: qtyInBase * (ing?.cost_per_unit || 0),
          staff_name: loggedStaff.name,
          station
        })
        setScreen("home")
      }}
      saving={saving} stationColor={stationColor} 
    />
  }

  
  if (screen==="production") {
    return <ProductionForm
      ingredients={filteredIngredients} subRecipes={filteredSubRecipes} frozenProducts={filteredFrozenProducts}
      subRecipeIngs={subRecipeIngs} frozenRecipes={frozenRecipes}
      stationColor={stationColor} saving={saving}
      onBack={() => setScreen("home")}
      onSubmit={async (payload) => {
        setSaving(true)
        try {
          const packs = payload.batchQty
          
          if (payload.prodType === "product") {
            const ingredients_used = payload.recipeLines.map(l => {
              const ing = ingredientsById[l.ingredient_id]
              return { ingredient_id:l.ingredient_id, name:ing?.name||l.ingredient_name||"", qty:Math.round(l.qty*packs*100)/100, unit:l.unit||ing?.unit||"" }
            })
            await submit("production", {
              product_sku: payload.prodId,
              item_name: payload.selectedItem?.name || "",
              batch_qty: packs,
              actual_yield: packs,
              yield_unit: "pack",
              notes: payload.notes,
              date: payload.date||new Date().toISOString().slice(0,10),
              needs_recipe_review: false,
              ingredients_used
            })
          } else {
            const sub = payload.selectedItem
            const ingredients_used = payload.recipeLines.map(l => {
              const ing = ingredients.find(i => i.id === l.ingredient_id)
              return { ingredient_id:l.ingredient_id, name:ing?.name||"", qty:Math.round(l.qty*packs*100)/100, unit:l.unit||ing?.unit||"" }
            })
            await submit("production", {
              sub_recipe_id: payload.prodId,
              item_name: sub?.name || "",
              batch_qty: packs,
              actual_yield: Math.round((sub?.yield_qty||1) * packs * 100)/100,
              yield_unit: sub?.yield_unit || sub?.unit || "gr",
              notes: payload.notes,
              date: payload.date||new Date().toISOString().slice(0,10),
              needs_recipe_review: false,
              ingredients_used
            })
          }
          setScreen("home")
        } catch (e) {
          alert("Error saving production: "+e.message)
        } finally {
          setSaving(false)
        }
      }}
    />
  }

  if (screen==="trial") {
    return <TrialForm
      ingredients={filteredIngredients} allProducts={allProducts}
      stationColor={stationColor} saving={saving}
      onBack={() => setScreen("home")}
      onSubmit={async (payload) => {
        setSaving(true)
        try {
          await submit("trial", {
            trialName: payload.trialName,
            notes: payload.notes,
            items: payload.items.map(it => {
              const ing = ingredientsById[it.ingredient_id]
              return {
                ingredient_id: it.ingredient_id,
                ingredient_name: ing?.name,
                qty: parseNum(it.qty),
                unit: it.unit
              }
            })
          })
          setScreen("home")
        } catch(e) {
          alert("Error: " + e.message)
        } finally {
          setSaving(false)
        }
      }}
    />
  }

  if (screen==="requisition") {
    return <RequisitionForm
      ingredients={filteredIngredients}
      stationColor={stationColor} saving={saving}
      onBack={() => setScreen("home")}
      onSubmit={async (payload) => {
        setSaving(true)
        try {
          await submit("requisition", {
            needed_by: payload.date,
            notes: payload.notes,
            items: payload.items.map(i => { 
              const ing = ingredientsById[i.ingredient_id]
              return { 
                ingredient_id: i.ingredient_id, 
                ingredient_name: ing?.name || "", 
                qty: parseNum(i.qty), 
                unit: i.unit || ing?.unit || "", 
                supplier: ing?.supplier || "" 
              } 
            })
          })
          setScreen("home")
        } catch(e) {
          alert("Error: " + e.message)
        } finally {
          setSaving(false)
        }
      }}
    />
  }

  return null
}
