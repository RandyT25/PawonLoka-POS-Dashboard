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

function IngSearch({ value, onChange, ingredients, subRecipes, showSubs = true }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [cursor, setCursor] = useState(-1)
  const ref = React.useRef(null)
  const listRef = React.useRef(null)

  const all = [
    ...ingredients.filter(i => i.category !== "Semi-finished").map(i => ({ ...i, _g:"Raw" })),
    ...(showSubs ? subRecipes.map(s => ({ ...s, _g:"Sub" })) : []),
  ]
  const filtered = q ? all.filter(x => x.name.toLowerCase().includes(q.toLowerCase())) : all
  const sel = all.find(x => x.id === value)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(""); setCursor(-1) } }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  function handleKey(e) {
    if (!open) { if (e.key==="Enter"||e.key==="ArrowDown") setOpen(true); return }
    if (e.key==="ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c+1, filtered.length-1)) }
    else if (e.key==="ArrowUp") { e.preventDefault(); setCursor(c => Math.max(c-1, 0)) }
    else if (e.key==="Enter") {
      e.preventDefault()
      if (cursor >= 0 && filtered[cursor]) { onChange(filtered[cursor]); setOpen(false); setQ(""); setCursor(-1) }
    }
    else if (e.key==="Escape") { setOpen(false); setQ(""); setCursor(-1) }
  }

  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const el = listRef.current.children[cursor]
      if (el) el.scrollIntoView({ block:"nearest" })
    }
  }, [cursor])

  return (
    <div ref={ref} style={{ position:"relative", flex:1, minWidth:0 }}>
      <div onClick={()=>{ setOpen(o=>!o); setQ(""); setCursor(-1) }}
        className="bo-select"
        style={{ cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 10px", userSelect:"none" }}>
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:13, color:sel?"var(--ink)":"var(--ink4)" }}>
          {sel ? `${sel.name}${sel.cost_per_unit>0?` · Rp ${Math.round(sel.cost_per_unit).toLocaleString("id-ID")}/${sel.unit}`:""}` : "— Select ingredient or sub-recipe —"}
        </span>
        <span style={{ fontSize:9, color:"var(--ink4)", flexShrink:0, marginLeft:4 }}>▼</span>
      </div>
      {open && (
        <div style={{ position:"absolute", zIndex:9999, top:"calc(100% + 2px)", left:0, right:0, background:"#fff", border:"1.5px solid var(--brand,#2563eb)", borderRadius:8, boxShadow:"0 8px 24px rgba(0,0,0,0.12)" }}>
          <input autoFocus value={q} onChange={e=>{setQ(e.target.value);setCursor(-1)}}
            onKeyDown={handleKey} placeholder="Type to search..."
            onClick={e=>e.stopPropagation()}
            style={{ width:"100%", padding:"8px 10px", border:"none", borderBottom:"1px solid #f0f0f0", fontSize:13, outline:"none", boxSizing:"border-box", borderRadius:"8px 8px 0 0", fontFamily:"inherit" }} />
          <div ref={listRef} style={{ maxHeight:240, overflowY:"auto" }}>
            {filtered.length===0
              ? <div style={{ padding:"10px 12px", fontSize:12, color:"var(--ink4)", textAlign:"center" }}>No results</div>
              : filtered.map((o,i) => (
                <div key={o.id}
                  onMouseDown={()=>{ onChange(o); setOpen(false); setQ(""); setCursor(-1) }}
                  onMouseEnter={()=>setCursor(i)}
                  style={{ padding:"8px 12px", fontSize:13, cursor:"pointer",
                    background: i===cursor ? "var(--brand-lt,#eff6ff)" : o.id===value ? "#f0fdf4" : "transparent",
                    color: o._g==="Sub" ? "#7c3aed" : "var(--ink)",
                    fontWeight: o.id===value ? 700 : 400,
                    borderLeft: i===cursor ? "3px solid var(--brand,#2563eb)" : "3px solid transparent" }}>
                  {o.name}
                  {o._g==="Sub" && <span style={{ fontSize:10, color:"#7c3aed", marginLeft:4 }}>(sub)</span>}
                  {o.cost_per_unit>0 && <span style={{ fontSize:10, color:"var(--ink4)", marginLeft:6 }}>Rp {Math.round(o.cost_per_unit).toLocaleString("id-ID")}/{o.unit}</span>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

function RecipePanel({ item, itemType, ingredients, subRecipes, onSaved, onCancel }) {
  const [rows,      setRows]      = useState([])
  const [yieldQty,  setYieldQty]  = useState(1)
  const [yieldUnit, setYieldUnit] = useState("gr")
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState(null)

  const all = [...ingredients, ...subRecipes]

  useEffect(() => {
    if (!item?.id) return
    setRows([]); setMsg(null)
    setYieldQty(item.yield_qty || 1)
    // For sub-recipes, prefer stored yield_unit, fallback to ingredient unit
    const ingUnit = itemType === "sub" ? (item.unit || "portion") : "portion"
    setYieldUnit(item.yield_unit || ingUnit)
    const table = itemType === "sub" ? "sub_recipe_ingredients" : "recipes"
    const loadRecipe = async () => {
      let data = null
      if (itemType === "sub") {
        const res = await supabase.from(table).select("*").eq("sub_recipe_id", item.id)
        data = res.data
      } else {
        const res1 = await supabase.from("recipes").select("*").eq("productSku", item.id)
        data = res1.data
      }
      if (data?.length) setRows(data.map(r => {
        const found = all.find(x => x.id === r.ingredient_id)
        return {
          ingredient_id: r.ingredient_id,
          name: r.ingredient_name || found?.name || "",
          qty: r.qty || 0,
          unit: found?.unit || r.unit || "gr",
        }
      }))
    }
    loadRecipe()
  }, [item?.id, itemType])

  const totalCost = rows.reduce((sum, row) => {
    const found = all.find(x => x.id === row.ingredient_id)
    if (!found?.cost_per_unit) return sum
    return sum + (found.cost_per_unit / (UNIT_TO_BASE[found.unit]||1)) * toBase(row.qty, row.unit)
  }, 0)

  const yieldBase   = toBase(yieldQty, yieldUnit)
  const costPerUnit = itemType==="sub" && yieldBase>0 ? totalCost/yieldBase : 0

  function addRow()          { setRows(r => [...r, { ingredient_id:"", name:"", qty:"", unit:"gr" }]) }
  function removeRow(i)      { setRows(r => r.filter((_,idx)=>idx!==i)) }
  function updateRow(i, patch){ setRows(r => r.map((x,idx)=>idx===i?{...x,...patch}:x)) }

  function handleIngChange(i, ingId) {
    const found = all.find(x => x.id === ingId)
    updateRow(i, { ingredient_id: ingId, name: found?.name||"", unit: found?.unit||"gr" })
  }

  async function save() {
    const valid = rows.filter(r => r.ingredient_id && parseFloat(r.qty) > 0)
    if (!valid.length) { setMsg({ err:true, text:"Add at least 1 ingredient with qty > 0" }); return }
    setSaving(true); setMsg(null)
    const inserts = valid.map(r => ({
      ingredient_id: r.ingredient_id,
      ingredient_name: r.name || all.find(x=>x.id===r.ingredient_id)?.name || "",
      qty: parseFloat(r.qty), unit: r.unit,
    }))
    try {
      if (itemType === "sub") {
        const { error: d } = await supabase.from("sub_recipe_ingredients").delete().eq("sub_recipe_id", item.id)
        if (d) throw d
        const { error: ins } = await supabase.from("sub_recipe_ingredients").insert(inserts.map(r=>({...r, sub_recipe_id:item.id})))
        if (ins) throw ins
        const { error: u } = await supabase.from("sub_recipes").update({ yield_qty:yieldQty, yield_unit:yieldUnit, cost_per_unit:costPerUnit }).eq("id", item.id)
        if (u) throw u
        if (item.ingredient_id) {
          await supabase.from("ingredients").update({ cost_per_unit:costPerUnit }).eq("id", item.ingredient_id)
        }
        setMsg({ err:false, text:`✓ Saved! Cost: Rp ${costPerUnit.toFixed(2)}/${yieldUnit}` })
        onSaved({ cost_per_unit:costPerUnit, yield_qty:yieldQty, yield_unit:yieldUnit })
      } else {
        const { error: d } = await supabase.from("recipes").delete().eq("productSku", item.id)
        if (d) throw d
        const { error: ins } = await supabase.from("recipes").insert(inserts.map(r=>({...r, product_id:item.id, productSku:item.id})))
        if (ins) throw ins
        await supabase.from("products").update({ cogs:Math.round(totalCost) }).eq("sku", item.id)
        setMsg({ err:false, text:`✓ Saved! COGS: ${fmtRp(totalCost)}` })
        onSaved({ cogs:Math.round(totalCost) })
      }
    } catch(e) {
      setMsg({ err:true, text:"Error: "+e.message })
    }
    setSaving(false)
  }

  const sellingPrice = item?.price || 0
  const margin = sellingPrice>0 && totalCost>0 ? pct(sellingPrice-totalCost, sellingPrice) : null

  return (
    <div style={{ padding:"24px 28px", maxWidth:780 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, paddingBottom:16, borderBottom:"1px solid var(--surface3,#f0f0f0)" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:800, color:"var(--ink,#1f2937)" }}>{item.icon||"🥣"} {item.name}</div>
          <div style={{ fontSize:12, color:"var(--ink4,#6b7280)", marginTop:4 }}>
            {itemType==="sub" ? "Sub-recipe" : "Dish"} · Category: {item.category||item.cat||"—"}
          </div>
          {/* Recipe COGS inline on mobile */}
          <div className="recipe-cogs-inline" style={{ display:"none", marginTop:10, padding:"10px 14px", border:"1.5px solid var(--surface3,#e5e7eb)", borderRadius:10 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--ink4,#6b7280)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:2 }}>Recipe COGS</div>
            <div style={{ fontSize:22, fontWeight:900, color: totalCost>0?"var(--green,#059669)":"var(--ink4,#9ca3af)" }}>{fmtRp(totalCost)}</div>
            {itemType==="sub" && yieldBase>0 && <div style={{ fontSize:12, color:"var(--ink4,#6b7280)", marginTop:2 }}>Rp {(totalCost/yieldBase).toFixed(2)}/{yieldUnit}</div>}
            {margin!==null && (
              <div style={{ marginTop:6, fontSize:12, fontWeight:700, padding:"2px 8px", borderRadius:10, display:"inline-block",
                background:margin>=65?"#d1fae5":margin>=45?"#fef3c7":"#fee2e2",
                color:margin>=65?"#065f46":margin>=45?"#92400e":"#991b1b" }}>
                {margin}% margin
              </div>
            )}
          </div>
        </div>
        <div className="recipe-cogs-desktop" style={{ textAlign:"right", padding:"12px 16px", border:"1.5px solid var(--surface3,#e5e7eb)", borderRadius:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--ink4,#6b7280)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Recipe COGS</div>
          <div style={{ fontSize:24, fontWeight:900, color: totalCost>0?"var(--green,#059669)":"var(--ink4,#9ca3af)" }}>{fmtRp(totalCost)}</div>
          {itemType==="sub" && yieldBase>0 && <div style={{ fontSize:12, color:"var(--ink4,#6b7280)", marginTop:2 }}>Rp {(totalCost/yieldBase).toFixed(2)}/{yieldUnit}</div>}
          {margin!==null && (
            <div style={{ marginTop:6, fontSize:12, fontWeight:700, padding:"2px 8px", borderRadius:10, display:"inline-block",
              background:margin>=65?"#d1fae5":margin>=45?"#fef3c7":"#fee2e2",
              color:margin>=65?"#065f46":margin>=45?"#92400e":"#991b1b" }}>
              {margin}% margin
            </div>
          )}
        </div>
      </div>

      {/* Yield bar - sub only */}
      {itemType==="sub" && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", background:"#eff6ff", borderRadius:10, marginBottom:20, flexWrap:"wrap" }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#1e40af" }}>This recipe produces:</span>
          <input type="number" value={yieldQty} onChange={e=>setYieldQty(parseFloat(e.target.value)||1)}
            style={{ width:90, padding:"6px 10px", border:"1.5px solid #bfdbfe", borderRadius:8, fontSize:14, outline:"none", fontFamily:"inherit" }} />
          <select value={yieldUnit} onChange={e=>setYieldUnit(e.target.value)}
            style={{ padding:"6px 10px", border:"1.5px solid #bfdbfe", borderRadius:8, fontSize:14, background:"#fff", outline:"none", fontFamily:"inherit" }}>
            {UNITS.map(u=><option key={u}>{u}</option>)}
          </select>
          {totalCost>0 && yieldBase>0 && (
            <span style={{ fontSize:13, color:"#2563eb", fontWeight:600 }}>→ cost per {yieldUnit}: Rp {(totalCost/yieldBase).toFixed(2)}</span>
          )}
        </div>
      )}

      {/* Column headers */}
      <div className="recipe-ing-header" style={{ display:"grid", gridTemplateColumns:"1fr 100px 110px 110px 32px", gap:8, marginBottom:8, padding:"0 2px" }}>
        {["INGREDIENT / SUB-RECIPE","QTY","UNIT","COST",""].map((h,i)=>(
          <div key={i} style={{ fontSize:10, fontWeight:700, color:"var(--ink4,#6b7280)", textTransform:"uppercase", letterSpacing:"0.4px" }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
        {rows.map((row,i) => {
          const found = all.find(x=>x.id===row.ingredient_id)
          const cost  = found?.cost_per_unit ? (found.cost_per_unit/(UNIT_TO_BASE[found.unit]||1))*toBase(row.qty,row.unit) : 0
          return (
            <div key={i} className="recipe-ing-row" style={{ display:"grid", gridTemplateColumns:"1fr 100px 110px 110px 32px", gap:8, alignItems:"center" }}>
              <IngSearch
                value={row.ingredient_id||""}
                onChange={o=>handleIngChange(i,o.id)}
                ingredients={ingredients}
                subRecipes={subRecipes}
              />
              <input type="number" value={row.qty===0?"":row.qty} min="0" step="any"
                onChange={e=>updateRow(i,{qty:e.target.value})}
                className="bo-input" style={{ fontSize:13, textAlign:"center" }} placeholder="0" />
              <select value={row.unit} onChange={e=>updateRow(i,{unit:e.target.value})}
                className="bo-select" style={{ fontSize:13 }}>
                {UNITS.map(u=><option key={u}>{u}</option>)}
              </select>
              <div style={{ fontSize:13, fontWeight:700, color:cost>0?"var(--ink,#1f2937)":"var(--ink4,#9ca3af)", textAlign:"right" }}>
                {cost>0?fmtRp(cost):"—"}
              </div>
              <button onClick={()=>removeRow(i)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--red,#ef4444)", fontSize:16, padding:0, lineHeight:1 }}>✕</button>
            </div>
          )
        })}
        {rows.length===0 && <div style={{ fontSize:13, color:"var(--ink4,#9ca3af)", padding:"12px 0" }}>No ingredients yet.</div>}
      </div>

      <button onClick={addRow} className="bo-btn bo-btn-ghost" style={{ marginBottom:20, fontSize:13 }}>+ Add Ingredient</button>

      {/* Msg */}
      {msg && (
        <div style={{ padding:"8px 12px", borderRadius:8, fontSize:13, fontWeight:600, marginBottom:14,
          background:msg.err?"#fee2e2":"#d1fae5", color:msg.err?"#991b1b":"#065f46" }}>
          {msg.text}
        </div>
      )}

      {/* Footer */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, paddingTop:16, borderTop:"1px solid var(--surface3,#f0f0f0)" }}>
        <button onClick={onCancel} className="bo-btn bo-btn-ghost">Cancel</button>
        <button onClick={save} disabled={saving} className="bo-btn bo-btn-primary" style={{ minWidth:200 }}>
          {saving?"Saving...": itemType==="sub"?"Save Recipe & Update Sub Cost":"Save Recipe & Update COGS"}
        </button>
      </div>
    </div>
  )
}

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
      // Auto-sync: find Semi-finished ingredients that don't have a sub_recipe row yet
      const semiIngs = allIngs.filter(i => i.category === "Semi-finished")
      const existingIngIds = new Set(subs.map(s => s.ingredient_id).filter(Boolean))
      const missing = semiIngs.filter(i => !existingIngIds.has(i.id))
      if (missing.length > 0) {
        const newRows = missing.map(i => ({
          id: "SUB-" + i.id,
          name: i.name,
          unit: i.unit || "gr",
          cost_per_unit: i.cost_per_unit || 0,
          yield_qty: 1,
          yield_unit: i.unit || "gr",
          ingredient_id: i.id,
        }))
        await supabase.from("sub_recipes").upsert(newRows, { onConflict: "id" })
        subs = [...subs, ...newRows]
      }
      // Deduplicate by ingredient_id
      const seen = new Set()
      subs = subs.filter(s => {
        if (!s.ingredient_id) return true
        if (seen.has(s.ingredient_id)) return false
        seen.add(s.ingredient_id)
        return true
      })
      // Check which products have recipes
      const { data: recipeSkus } = await supabase.from("recipes").select("productSku")
      const hasRecipeSet = new Set((recipeSkus||[]).map(r=>r.productSku).filter(Boolean))
      setProducts((pRes.data||[]).map(p=>({...p,id:p.sku,category:p.cat,_hasRecipe:hasRecipeSet.has(p.sku)})))
      setSubRecipes(subs)
      setIngredients(allIngs)
      setLoading(false)
    })
  }, [tick])

  const onSaved = useCallback((patch) => {
    if (patch && selected) {
      setSelected(s => s ? {...s,...patch} : s)
      // Update the list item in-place for instant left panel refresh
      if (patch.cost_per_unit !== undefined || patch.yield_unit !== undefined) {
        setSubRecipes(prev => prev.map(s => s.id===selected.id ? {...s,...patch} : s))
      }
      if (patch.cogs !== undefined) {
        setProducts(prev => prev.map(p => p.id===selected.id ? {...p,...patch} : p))
      }
    }
    setTick(t => t+1)
  }, [selected])

  const listItems = (tab==="dish" ? products : subRecipes)
    .filter(x => !search || x.name?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--ink4)" }}>Loading recipes...</div>

  return (
    <div style={{ display:"flex", height:"calc(100vh - 56px)", overflow:"hidden" }} className={"recipe-root"+(selected?" has-selected":"")}>
      {/* LEFT */}
      <div className="recipe-left" style={{ width:300, minWidth:260, borderRight:"1px solid var(--surface3,#e5e7eb)", display:"flex", flexDirection:"column", background:"var(--surface,#fafafa)" }}>
        {/* Tabs */}
        <div style={{ display:"flex", padding:"10px 10px 0", gap:6, borderBottom:"1px solid var(--surface3,#e5e7eb)" }}>
          {[["dish","🍽 Dishes",products.length],["sub","🥣 Sub-recipes",subRecipes.length]].map(([t,l,cnt])=>(
            <button key={t} onClick={()=>{setTab(t);setSelected(null);setSearch("")}}
              className={"bo-btn bo-btn-sm "+(tab===t?"bo-btn-primary":"bo-btn-ghost")}
              style={{ flex:1, marginBottom:8 }}>
              {l} ({cnt})
            </button>
          ))}
        </div>
        {/* Search */}
        <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--surface2,#f0f0f0)" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
            className="bo-input" style={{ fontSize:13 }} />
        </div>
        {/* List */}
        <div style={{ flex:1, overflowY:"auto" }}>
          {listItems.map(item => {
            const hasCogs = (tab==="dish" ? (item.cogs||0) : (item.cost_per_unit||0)) > 0
            const hasRecipeFlag = tab==="dish" ? item._hasRecipe : (item.yield_qty > 0)
            const margin  = tab==="dish" && item.price>0 && item.cogs>0 ? pct(item.price-item.cogs,item.price) : null
            const isSel   = selected?.id===item.id
            return (
              <div key={item.id} onClick={()=>setSelected({...item,_type:tab})}
                style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid var(--surface2,#f3f4f6)",
                  background:isSel?"var(--brand-lt,#eff6ff)":"transparent",
                  borderLeft:isSel?"3px solid var(--brand,#2563eb)":"3px solid transparent",
                  transition:"background 0.1s" }}
                onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background="var(--surface,#f9fafb)" }}
                onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background="transparent" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", flex:1, minWidth:0 }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{item.icon||(tab==="sub"?"🥣":"🍴")}</span>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--ink,#1f2937)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                      <div style={{ fontSize:11, marginTop:2 }}>
                        {hasCogs
                          ? <span style={{ padding:"1px 6px", borderRadius:10, background:"#d1fae5", color:"#065f46", fontWeight:700 }}>✓ Has recipe</span>
                          : hasRecipeFlag
                          ? <span style={{ padding:"1px 6px", borderRadius:10, background:"#fef3c7", color:"#92400e", fontWeight:700 }}>Has recipe · No price</span>
                          : <span style={{ color:"var(--ink4,#9ca3af)" }}>No recipe</span>}
                        {hasCogs && tab==="sub" && <span style={{ color:"var(--brand,#2563eb)", fontWeight:600, marginLeft:4 }}>· Rp {(item.cost_per_unit||0).toFixed(2)}/{item.yield_unit||item.unit}</span>}
                        {hasCogs && tab==="dish" && <span style={{ color:"var(--brand,#2563eb)", fontWeight:600, marginLeft:4 }}>· COGS {Math.round(item.cogs||0).toLocaleString("id-ID")}</span>}
                      </div>
                    </div>
                  </div>
                  {margin!==null && (
                    <span style={{ fontSize:11, fontWeight:700, padding:"2px 6px", borderRadius:10, flexShrink:0, marginLeft:6,
                      background:margin>=65?"#d1fae5":margin>=45?"#fef3c7":"#fee2e2",
                      color:margin>=65?"#065f46":margin>=45?"#92400e":"#991b1b" }}>
                      {margin}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {listItems.length===0 && <div style={{ padding:24, textAlign:"center", color:"var(--ink4)", fontSize:13 }}>No items found</div>}
        </div>
      </div>

      {/* MOBILE BOTTOM SHEET */}
      {selected && (
        <div className="recipe-sheet-overlay" onClick={()=>setSelected(null)} />
      )}
      {/* RIGHT */}
      <div className="recipe-right" style={{ flex:1, overflowY:"auto", background:"#fff" }}>
        {selected ? (
          <RecipePanel
            key={selected.id+selected._type}
            item={selected}
            itemType={selected._type}
            ingredients={ingredients}
            subRecipes={subRecipes}
            onSaved={onSaved}
            onCancel={()=>setSelected(null)}
          />
        ) : (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--ink4,#9ca3af)" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📖</div>
            <div style={{ fontSize:14 }}>Select an item from the list to edit its recipe</div>
          </div>
        )}
      </div>
    </div>
  )
}
