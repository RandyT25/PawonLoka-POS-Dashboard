import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const UNIT_EMPTY = { name:"" }

// Union of every unit that used to live in the 4 separately hardcoded lists
// (InvIngredients/InvPO/MarketPrices/RecipeEditor), used only to seed this page
// the very first time it loads. Casing variants (e.g. "Can"/"can") are kept as
// separate entries deliberately — safer to let the owner delete duplicates they
// don't want than to silently guess which casing is "correct".
const UNION_FALLBACK = [
  "gr","kg","ml","L","Galon","pcs","Ekor","butir","biji","buah","ikat","lembar",
  "bungkus","pack","sachet","botol","Can","tsp","tbsp","cup","porsi","portion","slice",
  "galon","ekor","bag","pouch","can","tray","liter","custom",
]

export default function UnitsOfMeasure() {
  const [units,    setUnits]    = useState([])
  const [usage,    setUsage]    = useState({})
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null) // null | "add" | unitRow
  const [form,     setForm]     = useState(UNIT_EMPTY)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:s }, { data:ings }] = await Promise.all([
      supabase.from("app_settings").select("units").eq("id","main").maybeSingle(),
      supabase.from("ingredients").select("unit,conversions"),
    ])
    let list = s?.units
    if (!list || list.length === 0) {
      list = UNION_FALLBACK.map((name,i) => ({ id:"UOM-"+Date.now()+"-"+i, name }))
      await supabase.from("app_settings").upsert({ id:"main", units:list }, { onConflict:"id" })
    }
    setUnits(list)

    const counts = {}
    ;(ings||[]).forEach(ing => {
      if (ing.unit) counts[ing.unit] = (counts[ing.unit]||0) + 1
      ;(ing.conversions||[]).forEach(c => { if (c.unit) counts[c.unit] = (counts[c.unit]||0) + 1 })
    })
    setUsage(counts)
    setLoading(false)
  }

  function openAdd()   { setForm(UNIT_EMPTY); setModal("add") }
  function openEdit(u) { setForm({ name:u.name }); setModal(u) }

  async function save() {
    const name = form.name.trim()
    if (!name) return
    setSaving(true)

    if (modal === "add") {
      const newUnits = [...units, { id:"UOM-"+Date.now(), name }]
      await supabase.from("app_settings").update({ units:newUnits }).eq("id","main")
    } else {
      const oldName = modal.name
      const newUnits = units.map(u => u.id === modal.id ? { ...u, name } : u)
      await supabase.from("app_settings").update({ units:newUnits }).eq("id","main")

      if (oldName !== name) {
        const { data:allIngs } = await supabase.from("ingredients").select("id,unit,conversions")
        for (const ing of (allIngs||[])) {
          const patch = {}
          if (ing.unit === oldName) patch.unit = name
          const convs = ing.conversions||[]
          if (convs.some(c => c.unit === oldName)) {
            patch.conversions = convs.map(c => c.unit===oldName ? { ...c, unit:name } : c)
          }
          if (Object.keys(patch).length) await supabase.from("ingredients").update(patch).eq("id", ing.id)
        }
      }
    }
    await load()
    setModal(null); setForm(UNIT_EMPTY); setSaving(false)
  }

  async function deleteUnit(u) {
    const count = usage[u.name] || 0
    const warning = count > 0
      ? `"${u.name}" is currently used by ${count} ingredient${count!==1?"s":""} (as base unit or purchase unit). Deleting it here will NOT change those ingredients — it just stops "${u.name}" from being offered as a choice for new entries going forward. Delete anyway?`
      : `Delete "${u.name}"?`
    if (!confirm(warning)) return
    const newUnits = units.filter(x => x.id !== u.id)
    await supabase.from("app_settings").update({ units:newUnits }).eq("id","main")
    await load(); setModal(null)
  }

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800 }}>Units of Measure</div>
          <div style={{ fontSize:13, color:"var(--ink4)", marginTop:2 }}>{units.length} units · used by Ingredients, Purchase Orders, Market Prices, Recipes & COGS</div>
        </div>
        <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Unit</button>
      </div>

      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {units.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>No units yet. Add one to get started.</div>
        ) : (
          <table className="bo-table">
            <thead><tr><th>Name</th><th>Used by</th><th></th></tr></thead>
            <tbody>
              {units.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight:700 }}>{u.name}</td>
                  <td style={{ fontSize:12, color:"var(--ink4)" }}>{usage[u.name] ? `${usage[u.name]} ingredient${usage[u.name]!==1?"s":""}` : "—"}</td>
                  <td>
                    <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                      <button onClick={()=>openEdit(u)} className="bo-btn bo-btn-ghost bo-btn-sm">Edit</button>
                      <button onClick={()=>deleteUnit(u)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ color:"var(--red)" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="bo-modal" style={{ maxWidth:380 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add" ? "Add Unit" : "Edit — "+modal.name}</div>
              <button className="bo-modal-close" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row">
                <label className="bo-label">Unit Name *</label>
                <input value={form.name} onChange={e=>setForm({ name:e.target.value })} className="bo-input" autoFocus placeholder="e.g. Can, Jar, kg" />
              </div>
              {modal!=="add" && (usage[modal.name]||0) > 0 && (
                <div style={{ marginTop:10, fontSize:12, color:"var(--amber)" }}>
                  ⚠ Renaming will update all {usage[modal.name]} ingredient{usage[modal.name]!==1?"s":""} currently using "{modal.name}".
                </div>
              )}
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setModal(null)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving||!form.name.trim()} className="bo-btn bo-btn-primary">
                {saving ? "Saving..." : modal==="add" ? "Add" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
