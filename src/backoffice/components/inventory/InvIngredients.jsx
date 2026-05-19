import { useState, useEffect } from "react"
import { supabase } from "../../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }

const UNITS = ["gr","kg","ml","L","Galon","pcs","Ekor","butir","biji","buah","lembar","bungkus","pack","sachet","tsp","tbsp","cup","porsi"]
const EMPTY = { name:"", sku:"", unit:"gr", min_stock:0, stock:0, cost_per_unit:0, supplier:"", category:"General" }

export default function InvIngredients() {
  const [ingredients, setIngredients] = useState([])
  const [suppliers,   setSuppliers]   = useState([])
  const [search,      setSearch]      = useState("")
  const [filter,      setFilter]      = useState("all")
  const [modal,       setModal]       = useState(null)
  const [form,        setForm]        = useState(EMPTY)
  const [saving,      setSaving]      = useState(false)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:ings }, { data:sups }] = await Promise.all([
      supabase.from("ingredients").select("*").order("name"),
      supabase.from("suppliers").select("id,name"),
    ])
    setIngredients(ings||[])
    setSuppliers(sups||[])
    setLoading(false)
  }

  const lowStock = ingredients.filter(i => i.min_stock > 0 && i.stock <= i.min_stock && i.stock > 0)
  const outStock = ingredients.filter(i => i.stock <= 0)
  const semi     = ingredients.filter(i => i.category === "Semi-finished")

  const filtered = ingredients
    .filter(i => filter==="low" ? lowStock.includes(i) : filter==="out" ? outStock.includes(i) : filter==="semi" ? semi.includes(i) : true)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))

  function openAdd()   { setForm(EMPTY); setModal("add") }
  function openEdit(i) { setForm({ ...i }); setModal("edit") }
  function closeModal(){ setModal(null); setForm(EMPTY) }

  async function save() {
    if (!form.name) return
    setSaving(true)
    const payload = {
      name:          form.name.trim(),
      sku:           form.sku || form.name.toLowerCase().replace(/\s+/g,"-").slice(0,20),
      unit:          form.unit,
      min_stock:     parseFloat(form.min_stock)||0,
      stock:         parseFloat(form.stock)||0,
      cost_per_unit: parseFloat(form.cost_per_unit)||0,
      supplier:      form.supplier||null,
      category:      form.category||"General",
    }
    if (modal==="add") await supabase.from("ingredients").insert({ ...payload, id:"ING-"+Date.now() })
    else await supabase.from("ingredients").update(payload).eq("id", form.id)
    await load(); closeModal(); setSaving(false)
  }

  async function deleteIngredient(id) {
    if (!confirm("Delete this ingredient?")) return
    await supabase.from("ingredients").delete().eq("id", id)
    setIngredients(prev => prev.filter(i => i.id !== id))
  }

  function stockStatus(i) {
    if (i.stock <= 0)                              return { cls:"var(--red)",   label:"Out" }
    if (i.min_stock > 0 && i.stock <= i.min_stock) return { cls:"var(--amber)", label:"Low" }
    return { cls:"var(--green)", label:"OK" }
  }

  return (
    <div>
      {/* Filter pills + toolbar */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:4 }}>
          {[["all",`All (${ingredients.length})`],["low",`Low Stock (${lowStock.length})`],["out",`Out of Stock (${outStock.length})`],["semi",`Semi-finished (${semi.length})`]].map(([f,l])=>(
            <button key={f} onClick={()=>setFilter(f)} className={"bo-btn bo-btn-sm "+(filter===f?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--ink5)" }}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} className="bo-input" placeholder="Search ingredients..." style={{ paddingLeft:28, width:200 }} />
          </div>
          <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Ingredient</button>
        </div>
      </div>

      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
          <table className="bo-table">
            <thead>
              <tr><th>Ingredient</th><th>SKU</th><th>Unit</th><th>Stock</th><th>Min Stock</th><th>Cost / Unit</th><th>Stock Value</th><th>Supplier</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const val = (i.stock||0)*(i.cost_per_unit||0)
                const st  = stockStatus(i)
                return (
                  <tr key={i.id}>
                    <td>
                      <div style={{ fontWeight:700, color:"var(--ink)" }}>{i.name}</div>
                      {i.category==="Semi-finished" && <div style={{ fontSize:10, fontWeight:700, color:"#6554C0" }}>SEMI-FINISHED</div>}
                    </td>
                    <td style={{ fontFamily:"monospace", fontSize:11, color:"var(--ink5)" }}>{i.sku||"—"}</td>
                    <td>{i.unit}</td>
                    <td style={{ fontWeight:700, color:st.cls }}>{i.stock||0}</td>
                    <td style={{ color:"var(--ink5)" }}>{i.min_stock||"—"}</td>
                    <td>{i.cost_per_unit>0?fmt(i.cost_per_unit)+"/"+i.unit:<span style={{color:"var(--ink5)"}}>Not set</span>}</td>
                    <td style={{ fontWeight:600, color:"var(--ink2)" }}>{val>0?fmt(val):"—"}</td>
                    <td style={{ fontSize:12, color:"var(--ink4)" }}>{i.supplier||"—"}</td>
                    <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:st.cls+"22", color:st.cls }}>{st.label}</span></td>
                    <td>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>openEdit(i)} className="bo-btn bo-btn-ghost bo-btn-sm">Edit</button>
                        <button onClick={()=>deleteIngredient(i.id)} className="bo-btn bo-btn-danger bo-btn-sm">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length===0 && <tr><td colSpan={10} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>No ingredients found</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="bo-overlay" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal">
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Add Ingredient":"Edit Ingredient"}</div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" autoFocus /></div>
                <div><label className="bo-label">SKU</label><input value={form.sku||""} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} className="bo-input" placeholder="Auto if empty" /></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Base Unit</label>
                  <select value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} className="bo-select">
                    {UNITS.map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div><label className="bo-label">Category</label>
                  <select value={form.category||"General"} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="bo-select">
                    <option>General</option><option>Semi-finished</option><option>Beverage</option><option>Food</option><option>Packaging</option>
                  </select>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Current Stock</label><input type="number" value={form.stock||0} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} className="bo-input" /></div>
                <div><label className="bo-label">Min Stock Alert</label><input type="number" value={form.min_stock||0} onChange={e=>setForm(f=>({...f,min_stock:e.target.value}))} className="bo-input" /></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Cost per Unit (Rp)</label><input type="number" value={form.cost_per_unit||0} onChange={e=>setForm(f=>({...f,cost_per_unit:e.target.value}))} className="bo-input" /></div>
                <div><label className="bo-label">Supplier</label>
                  <select value={form.supplier||""} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} className="bo-select">
                    <option value="">— Select supplier —</option>
                    {suppliers.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              {modal==="edit" && <button onClick={()=>deleteIngredient(form.id).then(closeModal)} className="bo-btn bo-btn-danger">Delete</button>}
              <button onClick={save} disabled={saving||!form.name} className="bo-btn bo-btn-primary">{saving?"Saving...":modal==="add"?"Add":"Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
