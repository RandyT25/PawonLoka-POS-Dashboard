import React, { useState, useEffect, useCallback } from "react"
import { supabase } from "../../lib/supabase"

const UNIT_TO_BASE = {
  gr:1,g:1,kg:1000,ml:1,mL:1,L:1000,Galon:19000,
  pcs:1,butir:1,biji:1,buah:1,lembar:1,ekor:1,Ekor:1,
  tsp:5,tbsp:15,cup:240,portion:1,porsi:1,slice:1,
  bungkus:1,pack:1,sachet:1,ikat:1,botol:1,
}
const UNITS = Object.keys(UNIT_TO_BASE)
function toBase(qty, unit) { return (qty||0) * (UNIT_TO_BASE[unit] || 1) }
function fmtRp(n) { if (!n || isNaN(n)) return "—"; return "Rp " + Math.round(n).toLocaleString("id-ID") }
function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0 }

/* ─── SEARCHABLE DROPDOWN ─────────────────────────────────── */
function IngSelect({ value, onChange, ingredients, subRecipes }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const ref = React.useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const all = [
    ...ingredients.map(i => ({ ...i, _g: "Raw" })),
    ...subRecipes.map(s => ({ ...s, _g: "Sub-recipe" })),
  ]
  const sel = all.find(x => x.id === value)
  const filtered = q ? all.filter(x => x.name.toLowerCase().includes(q.toLowerCase())) : all

  return (
    <div ref={ref} style={{ position:"relative", flex:1, minWidth:0 }}>
      <div onClick={() => { setOpen(o => !o); setQ("") }}
        style={{ padding:"7px 10px", border:"1.5px solid #d1d5db", borderRadius:8, cursor:"pointer", fontSize:13, background:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center", gap:4 }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: sel ? "#111" : "#9ca3af", flex:1 }}>
          {sel ? sel.name : "— Select ingredient —"}
        </span>
        <span style={{ fontSize:9, color:"#9ca3af", flexShrink:0 }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ position:"absolute", zIndex:9999, top:"calc(100% + 2px)", left:0, right:0, background:"#fff", border:"1.5px solid #f59e0b", borderRadius:8, boxShadow:"0 8px 24px rgba(0,0,0,0.13)" }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
            onClick={e => e.stopPropagation()}
            style={{ width:"100%", padding:"8px 10px", border:"none", borderBottom:"1px solid #f0f0f0", fontSize:13, outline:"none", boxSizing:"border-box", borderRadius:"8px 8px 0 0" }} />
          <div style={{ maxHeight:220, overflowY:"auto" }}>
            {filtered.length === 0
              ? <div style={{ padding:"12px", fontSize:12, color:"#9ca3af", textAlign:"center" }}>No results</div>
              : filtered.map(o => (
                <div key={o.id} onMouseDown={() => { onChange(o); setOpen(false); setQ("") }}
                  style={{ padding:"8px 12px", fontSize:13, cursor:"pointer", background: o.id===value ? "#fff7ed" : "transparent",
                    color: o._g==="Sub-recipe" ? "#7c3aed" : "#111", fontWeight: o.id===value ? 700 : 400,
                    borderLeft: o.id===value ? "3px solid #f59e0b" : "3px solid transparent" }}
                  onMouseEnter={e => { if(o.id!==value) e.currentTarget.style.background="#f9fafb" }}
                  onMouseLeave={e => { if(o.id!==value) e.currentTarget.style.background="transparent" }}>
                  {o.name}
                  {o.cost_per_unit > 0 && <span style={{ fontSize:10, color:"#9ca3af", marginLeft:6 }}>
                    Rp {Math.round(o.cost_per_unit).toLocaleString("id-ID")}/{o.unit}
                  </span>}
                  {o._g==="Sub-recipe" && <span style={{ fontSize:10, color:"#7c3aed", marginLeft:4 }}>(sub)</span>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── RECIPE PANEL ────────────────────────────────────────── */
function RecipePanel({ item, itemType, ingredients, subRecipes, onSaved, onCancel }) {
  const [rows,      setRows]      = useState([])
  const [yieldQty,  setYieldQty]  = useState(1)
  const [yieldUnit, setYieldUnit] = useState("gr")
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState(null)

  // Load existing recipe lines
  useEffect(() => {
    if (!item?.id) return
    setRows([]); setMsg(null)
    if (itemType === "sub") {
      setYieldQty(item.yield_qty || 1)
      setYieldUnit(item.yield_unit || item.unit || "gr")
      supabase.from("sub_recipe_ingredients").select("*")
        .eq("sub_recipe_id", item.id)
        .then(({ data }) => {
          if (data?.length) setRows(data.map(r => ({
            id: r.id, ingredient_id: r.ingredient_id,
            name: r.ingredient_name || ingredients.find(i=>i.id===r.ingredient_id)?.name || subRecipes.find(s=>s.id===r.ingredient_id)?.name || "",
            qty: r.qty || 0, unit: r.unit || "gr"
          })))
        })
    } else {
      supabase.from("recipes").select("*")
        .eq("product_id", item.id)
        .then(({ data }) => {
          if (data?.length) setRows(data.map(r => ({
            id: r.id, ingredient_id: r.ingredient_id,
            name: r.ingredient_name || ingredients.find(i=>i.id===r.ingredient_id)?.name || subRecipes.find(s=>s.id===r.ingredient_id)?.name || "",
            qty: r.qty || 0, unit: r.unit || "gr"
          })))
        })
    }
  }, [item?.id, itemType])

  const all = [...ingredients, ...subRecipes]

  const totalCost = rows.reduce((sum, row) => {
    const found = all.find(x => x.id === row.ingredient_id)
    if (!found?.cost_per_unit) return sum
    const base = toBase(row.qty, row.unit)
    const baseUnit = UNIT_TO_BASE[found.unit] || 1
    return sum + (found.cost_per_unit / baseUnit) * base
  }, 0)

  const yieldBase = toBase(yieldQty, yieldUnit)
  const costPerUnit = itemType === "sub" && yieldBase > 0 ? totalCost / yieldBase : 0

  function addRow() { setRows(r => [...r, { ingredient_id:"", name:"", qty:0, unit:"gr" }]) }
  function removeRow(i) { setRows(r => r.filter((_,idx)=>idx!==i)) }
  function updateRow(i, patch) { setRows(r => r.map((x,idx)=>idx===i?{...x,...patch}:x)) }

  async function save() {
    const valid = rows.filter(r => r.ingredient_id && r.qty > 0)
    if (!valid.length) { setMsg({ err:true, text:"Add at least 1 ingredient with qty > 0" }); return }
    setSaving(true); setMsg(null)

    const inserts = valid.map(r => ({
      ingredient_id: r.ingredient_id,
      ingredient_name: r.name || all.find(x=>x.id===r.ingredient_id)?.name || "",
      qty: r.qty, unit: r.unit,
    }))

    try {
      if (itemType === "sub") {
        // Delete old lines
        const { error: delErr } = await supabase.from("sub_recipe_ingredients").delete().eq("sub_recipe_id", item.id)
        if (delErr) throw delErr

        // Insert new lines
        const { error: insErr } = await supabase.from("sub_recipe_ingredients").insert(
          inserts.map(r => ({ ...r, sub_recipe_id: item.id }))
        )
        if (insErr) throw insErr

        // Update sub_recipe cost + yield
        const { error: updErr } = await supabase.from("sub_recipes").update({
          yield_qty: yieldQty, yield_unit: yieldUnit, cost_per_unit: costPerUnit
        }).eq("id", item.id)
        if (updErr) throw updErr

        // Update the linked ingredient's cost_per_unit
        if (item.ingredient_id) {
          await supabase.from("ingredients").update({ cost_per_unit: costPerUnit }).eq("id", item.ingredient_id)
        }

        setMsg({ err:false, text:`✓ Saved! Cost: Rp ${Math.round(costPerUnit).toLocaleString("id-ID")}/${yieldUnit}` })
      } else {
        // Dish recipe
        const { error: delErr } = await supabase.from("recipes").delete().eq("product_id", item.id)
        if (delErr) throw delErr

        const { error: insErr } = await supabase.from("recipes").insert(
          inserts.map(r => ({ ...r, product_id: item.id }))
        )
        if (insErr) throw insErr

        // Update product COGS
        await supabase.from("products").update({ cogs: Math.round(totalCost) }).eq("sku", item.id)

        setMsg({ err:false, text:`✓ Saved! COGS: ${fmtRp(totalCost)}` })
      }
      onSaved()
    } catch(e) {
      setMsg({ err:true, text:"Error: " + e.message })
    }
    setSaving(false)
  }

  const sellingPrice = item?.price || 0
  const margin = sellingPrice > 0 && totalCost > 0 ? pct(sellingPrice - totalCost, sellingPrice) : null

  return (
    <div style={{ padding:24, maxWidth:700 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, paddingBottom:16, borderBottom:"1px solid #f0f0f0" }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:"#1f2937" }}>{item.icon||""} {item.name}</div>
          <div style={{ fontSize:12, color:"#6b7280", marginTop:3 }}>
            {itemType==="sub" ? "Semi-finished ingredient" : "Dish"} · Base unit: {item.unit||"gr"}
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", marginBottom:2 }}>Recipe COGS</div>
          <div style={{ fontSize:22, fontWeight:900, color: totalCost > 0 ? "#059669" : "#9ca3af" }}>{fmtRp(totalCost)}</div>
          {itemType==="sub" && yieldBase > 0 && <div style={{ fontSize:11, color:"#6b7280" }}>Rp {(totalCost/yieldBase).toFixed(2)}/{yieldUnit}</div>}
          {margin !== null && (
            <div style={{ marginTop:4, fontSize:12, fontWeight:700, padding:"2px 8px", borderRadius:10, display:"inline-block",
              background: margin>=65?"#d1fae5":margin>=45?"#fef3c7":"#fee2e2",
              color: margin>=65?"#065f46":margin>=45?"#92400e":"#991b1b" }}>
              {margin}% margin
            </div>
          )}
        </div>
      </div>

      {/* Yield bar (sub-recipes only) */}
      {itemType === "sub" && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"#eff6ff", borderRadius:10, marginBottom:16, flexWrap:"wrap" }}>
          <span style={{ fontSize:12, fontWeight:700, color:"#1e40af" }}>This recipe produces:</span>
          <input type="number" value={yieldQty} onChange={e=>setYieldQty(parseFloat(e.target.value)||1)}
            style={{ width:80, padding:"6px 8px", border:"1px solid #bfdbfe", borderRadius:6, fontSize:13, outline:"none" }} />
          <select value={yieldUnit} onChange={e=>setYieldUnit(e.target.value)}
            style={{ padding:"6px 8px", border:"1px solid #bfdbfe", borderRadius:6, fontSize:13, background:"#fff", outline:"none" }}>
            {UNITS.map(u=><option key={u}>{u}</option>)}
          </select>
          {totalCost > 0 && yieldBase > 0 && (
            <span style={{ fontSize:12, color:"#3b82f6", fontWeight:600 }}>
              → cost per {yieldUnit}: Rp {(totalCost/yieldBase).toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Column headers */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px 100px 32px", gap:8, marginBottom:8, padding:"0 4px" }}>
        {["INGREDIENT / SUB-RECIPE","QTY","UNIT","COST",""].map((h,i)=>(
          <div key={i} style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase" }}>{h}</div>
        ))}
      </div>

      {/* Ingredient rows */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {rows.map((row,i) => {
          const found = all.find(x => x.id === row.ingredient_id)
          const base = toBase(row.qty, row.unit)
          const baseUnit = UNIT_TO_BASE[found?.unit||"gr"] || 1
          const cost = found?.cost_per_unit ? (found.cost_per_unit / baseUnit) * base : 0
          return (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px 100px 32px", gap:8, alignItems:"center" }}>
              <IngSelect value={row.ingredient_id} ingredients={ingredients} subRecipes={subRecipes}
                onChange={o => updateRow(i, { ingredient_id:o.id, name:o.name, unit:o.unit||row.unit })} />
              <input type="number" value={row.qty} min="0" step="any"
                onChange={e => updateRow(i, { qty: parseFloat(e.target.value)||0 })}
                style={{ padding:"7px 8px", border:"1px solid #d1d5db", borderRadius:8, fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" }} />
              <select value={row.unit} onChange={e => updateRow(i, { unit:e.target.value })}
                style={{ padding:"7px 6px", border:"1px solid #d1d5db", borderRadius:8, fontSize:13, background:"#fff", outline:"none", width:"100%" }}>
                {UNITS.map(u=><option key={u}>{u}</option>)}
              </select>
              <div style={{ fontSize:12, fontWeight:700, color: cost>0?"#1f2937":"#9ca3af", textAlign:"right" }}>{cost>0?fmtRp(cost):"—"}</div>
              <button onClick={()=>removeRow(i)} style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", fontSize:16, padding:0, lineHeight:1 }}>✕</button>
            </div>
          )
        })}
        {rows.length === 0 && <div style={{ fontSize:13, color:"#9ca3af", padding:"12px 0" }}>No ingredients yet. Click + Add below.</div>}
      </div>

      <button onClick={addRow} style={{ padding:"7px 14px", background:"#f3f4f6", border:"1px dashed #d1d5db", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", color:"#374151", marginBottom:16 }}>
        + Add Ingredient
      </button>

      {/* Cost breakdown */}
      {rows.filter(r=>r.ingredient_id&&r.qty>0).length > 0 && (
        <div style={{ background:"#f9fafb", borderRadius:10, padding:14, marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#374151", textTransform:"uppercase", marginBottom:10 }}>Cost Breakdown</div>
          {rows.filter(r=>r.ingredient_id&&r.qty>0).map((row,i) => {
            const found = all.find(x => x.id === row.ingredient_id)
            const base = toBase(row.qty, row.unit)
            const baseUnit = UNIT_TO_BASE[found?.unit||"gr"] || 1
            const cost = found?.cost_per_unit ? (found.cost_per_unit / baseUnit) * base : 0
            const share = totalCost > 0 ? (cost / totalCost) * 100 : 0
            return (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 60px 80px 90px", gap:8, alignItems:"center", marginBottom:6 }}>
                <div style={{ fontSize:12, color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.name||found?.name||"?"}</div>
                <div style={{ fontSize:11, color:"#6b7280" }}>{row.qty} {row.unit}</div>
                <div style={{ background:"#e5e7eb", borderRadius:4, height:6, overflow:"hidden" }}>
                  <div style={{ height:6, width:share+"%", background:"#f59e0b", borderRadius:4 }} />
                </div>
                <div style={{ fontSize:12, fontWeight:700, textAlign:"right" }}>{fmtRp(cost)}</div>
              </div>
            )
          })}
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:800, borderTop:"1px solid #e5e7eb", paddingTop:8, marginTop:4 }}>
            <span>Total COGS</span><span style={{ color:"#059669" }}>{fmtRp(totalCost)}</span>
          </div>
        </div>
      )}

      {/* Message */}
      {msg && (
        <div style={{ padding:"8px 12px", borderRadius:8, fontSize:13, fontWeight:600, marginBottom:12,
          background: msg.err ? "#fee2e2" : "#d1fae5", color: msg.err ? "#991b1b" : "#065f46" }}>
          {msg.text}
        </div>
      )}

      {/* Footer */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, paddingTop:14, borderTop:"1px solid #f0f0f0" }}>
        <button onClick={onCancel} style={{ padding:"9px 18px", border:"1px solid #d1d5db", borderRadius:8, background:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
        <button onClick={save} disabled={saving}
          style={{ padding:"9px 20px", border:"none", borderRadius:8, background: saving?"#9ca3af":"#f59e0b", fontSize:13, fontWeight:700, cursor: saving?"not-allowed":"pointer", color:"#fff" }}>
          {saving ? "Saving..." : itemType==="sub" ? "Save Recipe & Update Sub Cost" : "Save Recipe & Update COGS"}
        </button>
      </div>
    </div>
  )
}

/* ─── MAIN ────────────────────────────────────────────────── */
export default function RecipeEditor() {
  const [tab,         setTab]         = useState("dish")
  const [search,      setSearch]      = useState("")
  const [products,    setProducts]    = useState([])
  const [subRecipes,  setSubRecipes]  = useState([])
  const [ingredients, setIngredients] = useState([])
  const [selected,    setSelected]    = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [tick,        setTick]        = useState(0)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from("products").select("sku,name,icon,price,cogs,cat").order("name"),
      supabase.from("sub_recipes").select("id,name,unit,cost_per_unit,yield_qty,yield_unit,ingredient_id").order("name"),
      supabase.from("ingredients").select("id,name,unit,cost_per_unit,category").order("name"),
    ]).then(async ([pRes, sRes, iRes]) => {
      const allIngs = iRes.data || []
      let subs = sRes.data || []

      // Auto-create sub_recipes rows for semi-finished ingredients
      const semiFinished = allIngs.filter(i => i.category==="Semi-finished" || i.name?.includes("(sub)"))
      const existingIngIds = new Set(subs.map(s=>s.ingredient_id).filter(Boolean))
      const toCreate = semiFinished.filter(i => !existingIngIds.has(i.id))

      if (toCreate.length) {
        const rows = toCreate.map(i => ({
          id: "SR-" + i.id.replace(/[^a-zA-Z0-9]/g,"-").slice(0,30),
          name: i.name,
          ingredient_id: i.id,
          unit: i.unit,
          cost_per_unit: i.cost_per_unit || 0,
          yield_qty: 1,
          yield_unit: i.unit,
        }))
        await supabase.from("sub_recipes").upsert(rows, { onConflict:"id", ignoreDuplicates:true })
        const { data:fresh } = await supabase.from("sub_recipes").select("id,name,unit,cost_per_unit,yield_qty,yield_unit,ingredient_id").order("name")
        subs = fresh || []
      }

      setProducts((pRes.data||[]).map(p => ({ ...p, id:p.sku, category:p.cat })))
      setSubRecipes(subs)
      setIngredients(allIngs)
      setLoading(false)
    })
  }, [tick])

  const onSaved = useCallback(() => {
    setSelected(null)
    setTick(t => t+1)
  }, [])

  const listItems = (tab==="dish" ? products : subRecipes)
    .filter(x => !search || x.name?.toLowerCase().includes(search.toLowerCase()))

  function pct2(a,b) { return b>0?Math.round((a/b)*100):null }

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>Loading recipes...</div>

  return (
    <div style={{ display:"flex", height:"calc(100vh - 56px)", overflow:"hidden", fontFamily:"inherit" }}>
      <style>{`
        .re-list-item{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;}
        .re-list-item:hover{background:#fff7ed;}
        .re-list-item.active{background:#fff7ed;border-left:3px solid #f59e0b;}
      `}</style>

      {/* LEFT PANEL */}
      <div style={{ width:300, minWidth:260, borderRight:"1px solid #e5e7eb", display:"flex", flexDirection:"column", background:"#fafafa" }}>
        <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb" }}>
          {[["dish","🍽 Dishes"],["sub","🥣 Sub-recipes"]].map(([t,l])=>(
            <button key={t} onClick={()=>{setTab(t);setSelected(null);setSearch("")}}
              style={{ flex:1, padding:"12px 8px", fontSize:13, fontWeight:600, border:"none", background:"none", cursor:"pointer",
                color: tab===t?"#f59e0b":"#6b7280", borderBottom: tab===t?"2px solid #f59e0b":"2px solid transparent" }}>
              {l} ({t==="dish"?products.length:subRecipes.length})
            </button>
          ))}
        </div>
        <div style={{ padding:"10px 12px", borderBottom:"1px solid #f0f0f0" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
            style={{ width:"100%", padding:"7px 10px", border:"1px solid #d1d5db", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }} />
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {listItems.map(item => {
            const hasCogs = (tab==="dish" ? item.cogs : item.cost_per_unit) > 0
            const margin = tab==="dish" && item.price>0 && item.cogs>0 ? pct2(item.price-item.cogs, item.price) : null
            const isSel = selected?.id===item.id
            return (
              <div key={item.id} className={"re-list-item"+(isSel?" active":"")}
                onClick={() => setSelected({ ...item, _type:tab })}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:20 }}>{item.icon||(tab==="sub"?"🥣":"🍴")}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#1f2937" }}>{item.name}</div>
                    <div style={{ fontSize:11, color:"#6b7280", marginTop:2, display:"flex", gap:6 }}>
                      {tab==="dish" && item.price>0 && <span>Rp {Math.round(item.price).toLocaleString("id-ID")}</span>}
                      {hasCogs
                        ? <span style={{ padding:"1px 6px", borderRadius:10, background:"#d1fae5", color:"#065f46", fontWeight:700 }}>✓ Has recipe</span>
                        : <span style={{ padding:"1px 6px", borderRadius:10, background:"#f3f4f6", color:"#6b7280", fontWeight:700 }}>No recipe</span>}
                    </div>
                  </div>
                </div>
                {margin!==null && (
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:10, flexShrink:0,
                    background: margin>=65?"#d1fae5":margin>=45?"#fef3c7":"#fee2e2",
                    color: margin>=65?"#065f46":margin>=45?"#92400e":"#991b1b" }}>
                    {margin}%
                  </span>
                )}
              </div>
            )
          })}
          {listItems.length===0 && <div style={{ padding:24, textAlign:"center", color:"#9ca3af", fontSize:13 }}>No items found</div>}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex:1, overflowY:"auto", background:"#fff" }}>
        {selected ? (
          <RecipePanel
            key={selected.id + selected._type}
            item={selected}
            itemType={selected._type}
            ingredients={ingredients}
            subRecipes={subRecipes}
            onSaved={onSaved}
            onCancel={() => setSelected(null)}
          />
        ) : (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", color:"#9ca3af" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📖</div>
            <div style={{ fontSize:14 }}>Select an item from the list to edit its recipe</div>
          </div>
        )}
      </div>
    </div>
  )
}
