import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { FOOD_CATEGORIES_FALLBACK, SUPPLY_CATEGORIES_FALLBACK, setFoodCategories, setSupplyCategories } from "../lib/ingredientCategories"

const CAT_EMPTY = { name:"" }

const TABS = {
  food:   { label:"Ingredients", singular:"Ingredient", column:"food_categories",   fallback:FOOD_CATEGORIES_FALLBACK,   idPrefix:"FCAT", setLive:setFoodCategories,   noun:"ingredient" },
  supply: { label:"Supplies",    singular:"Supply",     column:"supply_categories", fallback:SUPPLY_CATEGORIES_FALLBACK, idPrefix:"SCAT", setLive:setSupplyCategories, noun:"supply item" },
}

export default function IngredientCategories() {
  const [tab,     setTab]     = useState("food")
  const [cats,    setCats]    = useState([])
  const [usage,   setUsage]   = useState({})
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null) // null | "add" | catRow
  const [form,    setForm]    = useState(CAT_EMPTY)
  const [saving,  setSaving]  = useState(false)

  const conf = TABS[tab]

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    const [{ data:s }, { data:ings }] = await Promise.all([
      supabase.from("app_settings").select(conf.column).eq("id","main").maybeSingle(),
      supabase.from("ingredients").select("category"),
    ])
    let list = s?.[conf.column]
    if (!list || list.length === 0) {
      list = conf.fallback.map((name,i) => ({ id:conf.idPrefix+"-"+Date.now()+"-"+i, name }))
      await supabase.from("app_settings").upsert({ id:"main", [conf.column]:list }, { onConflict:"id" })
    } else {
      const seen = new Set()
      const deduped = list.filter(c => seen.has(c.name) ? false : (seen.add(c.name), true))
      if (deduped.length !== list.length) {
        list = deduped
        await supabase.from("app_settings").update({ [conf.column]:list }).eq("id","main")
      }
    }
    setCats(list)
    conf.setLive(list.map(c=>c.name))

    const counts = {}
    ;(ings||[]).forEach(ing => { if (ing.category) counts[ing.category] = (counts[ing.category]||0) + 1 })
    setUsage(counts)
    setLoading(false)
  }

  function openAdd()   { setForm(CAT_EMPTY); setModal("add") }
  function openEdit(c) { setForm({ name:c.name }); setModal(c) }

  async function save() {
    const name = form.name.trim()
    if (!name) return
    setSaving(true)

    if (modal === "add") {
      if (cats.some(c => c.name === name)) {
        alert(`"${name}" already exists in the list.`)
        setSaving(false)
        return
      }
      const newCats = [...cats, { id:conf.idPrefix+"-"+Date.now(), name }]
      await supabase.from("app_settings").update({ [conf.column]:newCats }).eq("id","main")
    } else {
      const oldName = modal.name
      if (name !== oldName && cats.some(c => c.id !== modal.id && c.name === name)) {
        alert(`"${name}" already exists in the list.`)
        setSaving(false)
        return
      }
      const newCats = cats.map(c => c.id === modal.id ? { ...c, name } : c)
      await supabase.from("app_settings").update({ [conf.column]:newCats }).eq("id","main")

      if (oldName !== name) {
        await supabase.from("ingredients").update({ category:name }).eq("category", oldName)
      }
    }
    await load()
    setModal(null); setForm(CAT_EMPTY); setSaving(false)
  }

  async function deleteCat(c) {
    const count = usage[c.name] || 0
    const warning = count > 0
      ? `"${c.name}" is currently used by ${count} ${conf.noun}${count!==1?"s":""}. Deleting it here will NOT change those items — it just stops "${c.name}" from being offered as a choice for new entries going forward. Delete anyway?`
      : `Delete "${c.name}"?`
    if (!confirm(warning)) return
    const newCats = cats.filter(x => x.id !== c.id)
    await supabase.from("app_settings").update({ [conf.column]:newCats }).eq("id","main")
    await load(); setModal(null)
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800 }}>Categories</div>
          <div style={{ fontSize:13, color:"var(--ink4)", marginTop:2 }}>Manage the category list shown when adding/editing Ingredients & Supplies</div>
        </div>
        <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Category</button>
      </div>

      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {Object.entries(TABS).map(([key,t]) => (
          <button key={key} onClick={()=>setTab(key)} className={"bo-btn bo-btn-sm "+(tab===key?"bo-btn-primary":"bo-btn-ghost")}>{t.label}</button>
        ))}
      </div>

      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>
        : cats.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>No categories yet. Add one to get started.</div>
        ) : (
          <table className="bo-table">
            <thead><tr><th>Name</th><th>Used by</th><th></th></tr></thead>
            <tbody>
              {cats.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight:700 }}>{c.name}</td>
                  <td style={{ fontSize:12, color:"var(--ink4)" }}>{usage[c.name] ? `${usage[c.name]} item${usage[c.name]!==1?"s":""}` : "—"}</td>
                  <td>
                    <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                      <button onClick={()=>openEdit(c)} className="bo-btn bo-btn-ghost bo-btn-sm">Edit</button>
                      <button onClick={()=>deleteCat(c)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ color:"var(--red)" }}>Delete</button>
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
              <div className="bo-modal-title">{modal==="add" ? "Add "+conf.singular+" Category" : "Edit — "+modal.name}</div>
              <button className="bo-modal-close" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row">
                <label className="bo-label">Category Name *</label>
                <input value={form.name} onChange={e=>setForm({ name:e.target.value })} className="bo-input" autoFocus placeholder={tab==="food"?"e.g. Poultry":"e.g. Charcoal"} />
              </div>
              {modal!=="add" && (usage[modal.name]||0) > 0 && (
                <div style={{ marginTop:10, fontSize:12, color:"var(--amber)" }}>
                  ⚠ Renaming will update all {usage[modal.name]} {conf.noun}{usage[modal.name]!==1?"s":""} currently using "{modal.name}".
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
