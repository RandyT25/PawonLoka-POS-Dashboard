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
    setYieldUnit(item.yield_unit || item.unit || "gr")
    const table = itemType === "sub" ? "sub_recipe_ingredients" : "recipes"
    const col   = itemType === "sub" ? "sub_recipe_id" : "product_id"
    supabase.from(table).select("*").eq(col, item.id).then(({ data }) => {
      if (data?.length) setRows(data.map(r => ({
        ingredient_id: r.ingredient_id,
        name: r.ingredient_name || all.find(x=>x.id===r.ingredient_id)?.name || "",
        qty: r.qty || 0,
        unit: r.unit || "gr",
      })))
    })
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
        const { error: d } = await supabase.from("recipes").delete().eq("product_id", item.id)
        if (d) throw d
        const { error: ins } = await supabase.from("recipes").insert(inserts.map(r=>({...r, product_id:item.id})))
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
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:"var(--ink,#1f2937)" }}>{item.icon||"🥣"} {item.name}</div>
          <div style={{ fontSize:12, color:"var(--ink4,#6b7280)", marginTop:4 }}>
            {itemType==="sub" ? "Semi-finished ingredient" : "Dish"} · Base unit: {item.unit||"gr"}
          </div>
        </div>
        <div style={{ textAlign:"right", padding:"12px 16px", border:"1.5px solid var(--surface3,#e5e7eb)", borderRadius:12 }}>
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 110px 110px 32px", gap:8, marginBottom:8, padding:"0 2px" }}>
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
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 100px 110px 110px 32px", gap:8, alignItems:"center" }}>
              <select value={row.ingredient_id||""} onChange={e=>handleIngChange(i,e.target.value)}
                className="bo-select" style={{ fontSize:13 }}>
                <option value="">— Select ingredient or sub-recipe —</option>
                <optgroup label="Raw Ingredients">
                  {ingredients.map(ing=>(
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit}){ing.cost_per_unit>0?` · Rp ${Math.round(ing.cost_per_unit).toLocaleString("id-ID")}/${ing.unit}`:""}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Sub-recipes">
                  {subRecipes.map(s=>(
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.unit}){s.cost_per_unit>0?` · Rp ${s.cost_per_unit.toFixed(2)}/${s.unit}`:""}
                    </option>
                  ))}
                </optgroup>
              </select>
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
      const semiFinished = allIngs.filter(i => i.category==="Semi-finished" || i.name?.includes("(sub)"))
      const existingIngIds = new Set(subs.map(s=>s.ingredient_id).filter(Boolean))
      const toCreate = semiFinished.filter(i => !existingIngIds.has(i.id))
      if (toCreate.length) {
        const newRows = toCreate.map(i => ({
          id: "SR-"+i.id.replace(/[^a-zA-Z0-9]/g,"-").slice(0,30),
          name:i.name, ingredient_id:i.id, unit:i.unit,
          cost_per_unit:i.cost_per_unit||0, yield_qty:1, yield_unit:i.unit,
        }))
        await supabase.from("sub_recipes").upsert(newRows, { onConflict:"id", ignoreDuplicates:true })
        const { data:fresh } = await supabase.from("sub_recipes").select("id,name,unit,cost_per_unit,yield_qty,yield_unit,ingredient_id").order("name")
        subs = fresh || []
      }
      setProducts((pRes.data||[]).map(p=>({...p,id:p.sku,category:p.cat})))
      setSubRecipes(subs)
      setIngredients(allIngs)
      setLoading(false)
    })
  }, [tick])

  const onSaved = useCallback((patch) => {
    if (patch) setSelected(s => s ? {...s,...patch} : s)
    setTick(t => t+1)
  }, [])

  const listItems = (tab==="dish" ? products : subRecipes)
    .filter(x => !search || x.name?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--ink4)" }}>Loading recipes...</div>

  return (
    <div style={{ display:"flex", height:"calc(100vh - 56px)", overflow:"hidden" }}>
      {/* LEFT */}
      <div style={{ width:300, minWidth:260, borderRight:"1px solid var(--surface3,#e5e7eb)", display:"flex", flexDirection:"column", background:"var(--surface,#fafafa)" }}>
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
                          : <span style={{ color:"var(--ink4,#9ca3af)" }}>No recipe</span>}
                        {hasCogs && tab==="sub" && <span style={{ color:"var(--brand,#2563eb)", fontWeight:600, marginLeft:4 }}>· Rp {(item.cost_per_unit||0).toFixed(2)}/{item.unit}</span>}
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

      {/* RIGHT */}
      <div style={{ flex:1, overflowY:"auto", background:"#fff" }}>
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
