import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }

const EMPTY = { name:"", cat:"", price:"", desc:"", icon:"🍽", active:true, image_url:null }

export default function Products() {
  const [products,   setProducts]   = useState([])
  const [categories, setCategories] = useState([])
  const [search,     setSearch]     = useState("")
  const [catFilter,  setCatFilter]  = useState("all")
  const [modal,      setModal]      = useState(null)
  const [form,       setForm]       = useState(EMPTY)
  const [saving,     setSaving]     = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [preview,    setPreview]    = useState(null)
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products").select("*").order("cat").order("name"),
      supabase.from("categories").select("*").order("sort"),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
    setLoading(false)
  }

  const filtered = products.filter(p => {
    const matchCat    = catFilter === "all" || p.cat === catFilter
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  function openAdd()  { setForm(EMPTY); setPreview(null); setModal("add") }
  function openEdit(p){ setForm({ ...p, price: String(p.price) }); setPreview(p.image_url||null); setModal("edit") }
  function closeModal(){ setModal(null); setForm(EMPTY); setPreview(null) }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const ext  = file.name.split(".").pop()
      const path = `products/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert:true, contentType:file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path)
      setForm(f => ({ ...f, image_url: publicUrl }))
    } catch (err) {
      alert("Upload failed: " + err.message)
      setPreview(form.image_url||null)
    }
    setUploading(false)
  }

  async function removePhoto() {
    setPreview(null)
    setForm(f => ({ ...f, image_url: null }))
    if (fileRef.current) fileRef.current.value = ""
  }

  async function save() {
    if (!form.name || !form.price) return
    setSaving(true)
    const payload = {
      name:      form.name.trim(),
      cat:       form.cat,
      price:     parseInt(form.price) || 0,
      desc:      form.desc || null,
      icon:      form.icon || "🍽",
      active:    form.active !== false,
      image_url: form.image_url || null,
    }
    if (modal === "add") {
      const sku = form.cat.slice(0,3).toUpperCase() + Date.now().toString().slice(-6)
      await supabase.from("products").insert({ ...payload, sku })
    } else {
      await supabase.from("products").update(payload).eq("sku", form.sku)
    }
    await load()
    closeModal()
    setSaving(false)
  }

  async function toggleActive(p) {
    await supabase.from("products").update({ active: !p.active }).eq("sku", p.sku)
    setProducts(prev => prev.map(x => x.sku === p.sku ? { ...x, active: !x.active } : x))
  }

  async function deleteProduct(sku) {
    if (!confirm("Delete this product?")) return
    await supabase.from("products").delete().eq("sku", sku)
    setProducts(prev => prev.filter(p => p.sku !== sku))
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <input placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)} className="bo-input" style={{ maxWidth:240 }} />
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="bo-select" style={{ maxWidth:180 }}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
        <div style={{ marginLeft:"auto" }}>
          <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Product</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:20, padding:"10px 16px", background:"#fff", border:"1px solid var(--surface3)", borderRadius:"var(--r-xl)", marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:"var(--ink4)" }}>Total: <strong style={{ color:"var(--ink)" }}>{products.length}</strong></span>
        <span style={{ fontSize:12, color:"var(--ink4)" }}>Active: <strong style={{ color:"var(--green)" }}>{products.filter(p=>p.active).length}</strong></span>
        <span style={{ fontSize:12, color:"var(--ink4)" }}>Hidden: <strong style={{ color:"var(--ink5)" }}>{products.filter(p=>!p.active).length}</strong></span>
        <span style={{ fontSize:12, color:"var(--ink4)" }}>With photo: <strong style={{ color:"var(--brand)" }}>{products.filter(p=>p.image_url).length}</strong></span>
        <span style={{ fontSize:12, color:"var(--ink4)" }}>Showing: <strong style={{ color:"var(--ink)" }}>{filtered.length}</strong></span>
      </div>

      {/* Table */}
      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
          <table className="bo-table">
            <thead>
              <tr><th>Photo</th><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.sku} style={{ opacity: p.active ? 1 : 0.55 }}>
                  <td style={{ width:56, padding:"8px 12px" }}>
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} style={{ width:44, height:44, borderRadius:10, objectFit:"cover", border:"1px solid var(--surface3)", display:"block" }} />
                      : <div style={{ width:44, height:44, borderRadius:10, background:"var(--surface)", border:"1px solid var(--surface3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{p.icon||"🍽"}</div>
                    }
                  </td>
                  <td>
                    <div style={{ fontWeight:700, color:"var(--ink)" }}>{p.name}</div>
                    {p.desc && <div style={{ fontSize:11, color:"var(--ink5)", marginTop:1 }}>{p.desc}</div>}
                  </td>
                  <td style={{ fontFamily:"monospace", fontSize:11, color:"var(--ink5)" }}>{p.sku}</td>
                  <td><span className="bo-badge bo-badge-blue">{p.cat||"-"}</span></td>
                  <td style={{ fontWeight:700, color:"var(--brand)" }}>{fmt(p.price)}</td>
                  <td><span className={"bo-badge "+(p.active?"bo-badge-green":"bo-badge-amber")}>{p.active?"Active":"Hidden"}</span></td>
                  <td>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>openEdit(p)} className="bo-btn bo-btn-ghost bo-btn-sm">Edit</button>
                      <button onClick={()=>toggleActive(p)} className="bo-btn bo-btn-ghost bo-btn-sm">{p.active?"Hide":"Show"}</button>
                      <button onClick={()=>deleteProduct(p.sku)} className="bo-btn bo-btn-danger bo-btn-sm">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>No products found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="bo-overlay" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal">
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Add Product":"Edit Product"}</div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body">
              {/* Photo upload */}
              <div className="bo-form-row">
                <label className="bo-label">Product Photo</label>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div onClick={()=>!uploading&&fileRef.current?.click()} style={{ width:80, height:80, borderRadius:12, border:"2px dashed var(--surface3)", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden", flexShrink:0, position:"relative" }}>
                    {preview ? <img src={preview} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:28 }}>{form.icon||"🍽"}</span>}
                    {uploading && <div style={{ position:"absolute", inset:0, background:"rgba(255,255,255,0.8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--brand)" }}>Uploading…</div>}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading} className="bo-btn bo-btn-ghost bo-btn-sm">{uploading?"Uploading…":preview?"Change Photo":"Upload Photo"}</button>
                    {preview && <button type="button" onClick={removePhoto} className="bo-btn bo-btn-danger bo-btn-sm">Remove</button>}
                    <span style={{ fontSize:10, color:"var(--ink5)" }}>JPG/PNG · max 2MB</span>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile} />
                </div>
              </div>

              {/* Icon + Name */}
              <div style={{ display:"grid", gridTemplateColumns:"64px 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label className="bo-label">Icon</label>
                  <input value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))} className="bo-input" style={{ textAlign:"center", fontSize:24, padding:"6px" }} />
                </div>
                <div>
                  <label className="bo-label">Name *</label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" placeholder="Product name" autoFocus />
                </div>
              </div>

              <div className="bo-form-row">
                <label className="bo-label">Category</label>
                <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} className="bo-select">
                  <option value="">-- Select category --</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                </select>
              </div>

              <div className="bo-form-row">
                <label className="bo-label">Price (Rp) *</label>
                <input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} className="bo-input" placeholder="e.g. 25000" />
              </div>

              <div className="bo-form-row">
                <label className="bo-label">Description</label>
                <input value={form.desc||""} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} className="bo-input" placeholder="Optional description" />
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <label className="bo-label" style={{ marginBottom:0 }}>Available in POS</label>
                <input type="checkbox" checked={form.active!==false} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--brand)" }} />
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving||uploading||!form.name||!form.price} className="bo-btn bo-btn-primary">
                {saving?"Saving...":modal==="add"?"Add Product":"Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
