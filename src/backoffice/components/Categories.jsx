import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const COLORS = ["#0066FF","#00875A","#FF8B00","#DE350B","#6554C0","#00B8D9","#FF5630","#36B37E","#0A1628","#E91E8C"]
const EMPTY  = { name:"", icon:"🏷", color:"#0066FF" }

export default function Categories() {
  const [cats,     setCats]     = useState([])
  const [products, setProducts] = useState([])
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [dragIdx,  setDragIdx]  = useState(null)
  const [addProdModal, setAddProdModal] = useState(null) // category to add product to
  const [prodForm, setProdForm] = useState({ name:"", price:"", icon:"🍽", desc:"" })
  const [savingProd, setSavingProd] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("categories").select("*").order("sort"),
      supabase.from("products").select("sku,name,icon,cat,price,active").order("name"),
    ])
    setCats(c || [])
    setProducts(p || [])
    setLoading(false)
  }

  function countProducts(catName) { return products.filter(p => p.cat === catName).length }
  function getProducts(catName)   { return products.filter(p => p.cat === catName) }

  function openAdd()   { setForm(EMPTY); setModal("add") }
  function openEdit(c) { setForm({ ...c }); setModal("edit") }
  function closeModal(){ setModal(false); setForm(EMPTY) }

  async function save() {
    if (!form.name) return
    setSaving(true)
    const payload = { name:form.name.trim(), icon:form.icon||"🏷", color:form.color||"#0066FF" }
    if (modal === "add") {
      const maxSort = cats.length ? Math.max(...cats.map(c=>c.sort||0)) : 0
      await supabase.from("categories").insert({ ...payload, sort:maxSort+1 })
    } else {
      await supabase.from("categories").update(payload).eq("id", form.id)
    }
    await load(); closeModal(); setSaving(false)
  }

  async function deleteCategory(id, name) {
    const count = products.filter(p => p.cat === name).length
    if (count > 0) { alert(`Cannot delete — ${count} products in this category. Reassign first.`); return }
    if (!confirm(`Delete "${name}"?`)) return
    await supabase.from("categories").delete().eq("id", id)
    setCats(prev => prev.filter(c => c.id !== id))
  }

  // Drag reorder
  function onDragStart(i) { setDragIdx(i) }
  function onDragOver(e, i) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const r = [...cats]; const [m] = r.splice(dragIdx, 1); r.splice(i, 0, m)
    setDragIdx(i); setCats(r)
  }
  async function onDragEnd() {
    setDragIdx(null)
    await Promise.all(cats.map((c,i) => supabase.from("categories").update({ sort:i+1 }).eq("id",c.id)))
  }

  // Add product directly from category
  async function saveProduct() {
    if (!prodForm.name || !prodForm.price) return
    setSavingProd(true)
    const sku = addProdModal.name.slice(0,3).toUpperCase().replace(/\s/g,'') + Date.now().toString().slice(-6)
    await supabase.from("products").insert({
      sku, name:prodForm.name.trim(), cat:addProdModal.name,
      price:parseInt(prodForm.price)||0, icon:prodForm.icon||"🍽",
      desc:prodForm.desc||null, active:true, cogs:0
    })
    await load()
    setAddProdModal(null)
    setProdForm({ name:"", price:"", icon:"🍽", desc:"" })
    setSavingProd(false)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <span style={{ fontSize:13, color:"var(--ink4)", fontWeight:600 }}>
          {cats.length} categories · Drag to reorder
        </span>
        <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Category</button>
      </div>

      {loading ? <div style={{ textAlign:"center", color:"var(--ink5)", padding:40 }}>Loading...</div> : (
        <>
          {/* Card grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
            {cats.map((c, i) => (
              <div key={c.id}
                draggable
                onDragStart={()=>onDragStart(i)}
                onDragOver={e=>onDragOver(e,i)}
                onDragEnd={onDragEnd}
                style={{ background:"#fff", border:"1.5px solid var(--surface3)", borderRadius:16, overflow:"hidden", cursor:"grab", opacity:dragIdx===i?0.7:1, transition:"opacity 0.15s" }}
              >
                {/* Color header */}
                <div style={{ height:80, background:c.color||"#0066FF", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", position:"relative" }}>
                  <span style={{ fontSize:36 }}>{c.icon}</span>
                  <span style={{ fontSize:11, fontWeight:800, background:"rgba(255,255,255,0.25)", color:"#fff", padding:"3px 9px", borderRadius:20 }}>
                    {i+1}
                  </span>
                </div>
                {/* Info */}
                <div style={{ padding:"10px 14px 4px" }}>
                  <div style={{ fontSize:14, fontWeight:800, color:"var(--ink)" }}>{c.name}</div>
                  <div style={{ fontSize:11, color:"var(--ink5)", marginTop:2 }}>{countProducts(c.name)} products</div>
                </div>
                {/* Actions */}
                <div style={{ display:"flex", borderTop:"1px solid var(--surface3)", marginTop:8 }}>
                  <button onClick={()=>openEdit(c)} style={{ flex:1, padding:"8px 0", fontSize:12, fontWeight:600, color:"var(--ink4)", background:"none", border:"none", borderRight:"1px solid var(--surface3)", cursor:"pointer" }}>Edit</button>
                  <button onClick={()=>deleteCategory(c.id,c.name)} style={{ flex:1, padding:"8px 0", fontSize:12, fontWeight:600, color:"var(--red)", background:"none", border:"none", cursor:"pointer" }}>Delete</button>
                </div>
              </div>
            ))}

            {/* Add new card */}
            <div onClick={openAdd} style={{ background:"var(--surface)", border:"2px dashed var(--surface3)", borderRadius:16, height:160, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--ink5)", gap:6, transition:"all 0.15s" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="var(--brand)"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="var(--surface3)"}
            >
              <span style={{ fontSize:28 }}>+</span>
              <span style={{ fontSize:12, fontWeight:600 }}>Add Category</span>
            </div>
          </div>

          {/* Category → Products Map */}
          <div className="bo-card">
            <div className="bo-card-title">Category → Products Map</div>
            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {cats.map(c => {
                const prods = getProducts(c.name)
                return (
                  <div key={c.id} style={{ display:"flex", alignItems:"flex-start", padding:"12px 0", borderBottom:"1px solid var(--surface2)", gap:12 }}>
                    {/* Category label */}
                    <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:160, flexShrink:0 }}>
                      <div style={{ width:4, height:32, borderRadius:2, background:c.color||"var(--brand)", flexShrink:0 }} />
                      <span style={{ fontSize:18 }}>{c.icon}</span>
                      <div>
                        <div style={{ fontWeight:800, fontSize:13, color:"var(--ink)" }}>{c.name}</div>
                        <div style={{ fontSize:10, color:"var(--ink5)" }}>{prods.length} items</div>
                      </div>
                    </div>

                    {/* Products */}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, flex:1, alignItems:"center" }}>
                      {prods.map(p => (
                        <span key={p.sku} style={{ fontSize:11, background: p.active?"var(--surface)":"var(--surface2)", border:"1px solid var(--surface3)", borderRadius:20, padding:"3px 10px", color: p.active?"var(--ink3)":"var(--ink5)", fontWeight:500, opacity:p.active?1:0.6 }}>
                          {p.icon} {p.name}
                        </span>
                      ))}
                      {prods.length === 0 && <span style={{ fontSize:11, color:"var(--ink5)", fontStyle:"italic" }}>No products yet</span>}
                      {/* Quick add product button */}
                      <button onClick={()=>{ setAddProdModal(c); setProdForm({name:"",price:"",icon:c.icon,desc:""}) }}
                        style={{ fontSize:11, background:"none", border:"1px dashed var(--surface3)", borderRadius:20, padding:"3px 10px", color:"var(--brand)", fontWeight:600, cursor:"pointer" }}>
                        + Add product
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Edit/Add Category Modal */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal">
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Add Category":"Edit Category"}</div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div style={{ display:"grid", gridTemplateColumns:"80px 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label className="bo-label">Emoji Icon</label>
                  <input value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))}
                    className="bo-input" style={{ textAlign:"center", fontSize:28, padding:"8px 4px" }}
                    placeholder="🏷" />
                  <div style={{ fontSize:10, color:"var(--ink5)", marginTop:3, textAlign:"center" }}>Paste any emoji</div>
                </div>
                <div>
                  <label className="bo-label">Category Name *</label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                    className="bo-input" placeholder="e.g. Drinks" autoFocus />
                  {/* Live preview */}
                  {form.name && (
                    <div style={{ marginTop:8, height:50, background:form.color||"#0066FF", borderRadius:10, display:"flex", alignItems:"center", padding:"0 14px", gap:10 }}>
                      <span style={{ fontSize:22 }}>{form.icon}</span>
                      <span style={{ color:"#fff", fontWeight:800, fontSize:13 }}>{form.name}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Color</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
                  {COLORS.map(col => (
                    <div key={col} onClick={()=>setForm(f=>({...f,color:col}))}
                      style={{ width:32, height:32, borderRadius:"50%", background:col, cursor:"pointer",
                        border:form.color===col?"3px solid var(--ink)":"3px solid transparent",
                        transform:form.color===col?"scale(1.2)":"scale(1)", transition:"all 0.15s" }} />
                  ))}
                </div>
                <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:8 }}>
                  <label className="bo-label" style={{ marginBottom:0, flexShrink:0 }}>Custom:</label>
                  <input type="color" value={form.color||"#0066FF"} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                    style={{ width:40, height:32, padding:2, border:"1px solid var(--surface3)", borderRadius:6, cursor:"pointer" }} />
                  <span style={{ fontSize:11, color:"var(--ink5)" }}>{form.color}</span>
                </div>
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving||!form.name} className="bo-btn bo-btn-primary">
                {saving?"Saving...":modal==="add"?"Add Category":"Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      {addProdModal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setAddProdModal(null)}>
          <div className="bo-modal">
            <div className="bo-modal-header">
              <div className="bo-modal-title">
                Add Product to {addProdModal.icon} {addProdModal.name}
              </div>
              <button className="bo-modal-close" onClick={()=>setAddProdModal(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div style={{ display:"grid", gridTemplateColumns:"64px 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label className="bo-label">Icon</label>
                  <input value={prodForm.icon} onChange={e=>setProdForm(f=>({...f,icon:e.target.value}))}
                    className="bo-input" style={{ textAlign:"center", fontSize:24, padding:"6px" }} />
                </div>
                <div>
                  <label className="bo-label">Product Name *</label>
                  <input value={prodForm.name} onChange={e=>setProdForm(f=>({...f,name:e.target.value}))}
                    className="bo-input" placeholder="Product name" autoFocus />
                </div>
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Price (Rp) *</label>
                <input type="number" value={prodForm.price} onChange={e=>setProdForm(f=>({...f,price:e.target.value}))}
                  className="bo-input" placeholder="e.g. 25000" />
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Description</label>
                <input value={prodForm.desc} onChange={e=>setProdForm(f=>({...f,desc:e.target.value}))}
                  className="bo-input" placeholder="Optional" />
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setAddProdModal(null)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={saveProduct} disabled={savingProd||!prodForm.name||!prodForm.price} className="bo-btn bo-btn-primary">
                {savingProd?"Saving...":"Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
