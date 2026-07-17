import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }
function pct(a,b) { return b>0?Math.round(a/b*100):0 }

const EMPTY = { name:"", cat:"", price:"", desc:"", icon:"🍽", active:true, image_url:null, cogs:0, is_consignment:false }

export default function Products() {
  const [products,    setProducts]    = useState([])
  const [categories,  setCategories]  = useState([])
  const [recipes,     setRecipes]     = useState([])
  const [modifiers,   setModifiers]   = useState([])
  const [search,      setSearch]      = useState("")
  const [catFilter,   setCatFilter]   = useState("")
  const [viewMode,    setViewMode]    = useState("list") // list | grid
  const [modal,       setModal]       = useState(null)
  const [quickEdit,   setQuickEdit]   = useState(null)
  const [qForm,       setQForm]       = useState({})
  const [qSaving,     setQSaving]     = useState(false)
  const [selected,    setSelected]    = useState(new Set())
  const [bulkModal,   setBulkModal]   = useState(false)
  const [bulkMods,    setBulkMods]    = useState([])
  const [bulkSaving,  setBulkSaving]  = useState(false)
  const [form,        setForm]        = useState(EMPTY)
  const [variants,    setVariants]    = useState([])
  const [saving,      setSaving]      = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [uploading,   setUploading]   = useState(false)
  const [preview,     setPreview]     = useState(null)
  const [syncing,     setSyncing]     = useState(false)
  const [priceHistory,setPriceHistory]= useState([])
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: prods }, { data: cats }, { data: recs }, { data: mods }] = await Promise.all([
      supabase.from("products").select("*").order("cat").order("name"),
      supabase.from("categories").select("*").order("sort"),
      supabase.from("recipes").select("product_id,ingredient_id"),
      supabase.from("modifier_groups").select("id,name"),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
    setRecipes(recs || [])
    setModifiers(mods || [])
    setLoading(false)
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
    const matchCat    = !catFilter || p.cat === catFilter
    return matchSearch && matchCat
  })

  function hasRecipe(p) { return recipes.some(r => r.product_id === p.sku || r.product_id === p.id) }
  function getCatColor(catName) {
    const c = categories.find(x => x.name === catName || x.id === catName)
    return c?.color || "#6B778C"
  }
  function getCatIcon(catName) {
    const c = categories.find(x => x.name === catName || x.id === catName)
    return c?.icon
  }
  function margin(p) {
    if (!p.price || !p.cogs) return null
    return pct(p.price - p.cogs, p.price)
  }

  function toggleSelect(sku) {
    setSelected(prev => { const next = new Set(prev); next.has(sku) ? next.delete(sku) : next.add(sku); return next })
  }

  async function saveBulkModifiers() {
    setBulkSaving(true)
    await Promise.all([...selected].map(sku =>
      supabase.from("products").update({ linked_modifiers: bulkMods }).eq("sku", sku)
    ))
    setProducts(prev => prev.map(p => selected.has(p.sku) ? { ...p, linked_modifiers: bulkMods } : p))
    setBulkSaving(false); setBulkModal(false); setSelected(new Set())
  }

  function openAdd()   { setForm(EMPTY); setVariants([]); setPreview(null); setModal("add") }
  function openEdit(p) {
    setForm({ ...p, price: String(p.price), cogs: String(p.cogs||0) })
    setVariants(p.variants || [])
    setPreview(p.image_url || null)
    setPriceHistory([])
    setModal("edit")
    supabase.from("price_history").select("*").eq("sku", p.sku).order("changed_at", { ascending:false }).limit(10)
      .then(({ data }) => setPriceHistory(data || []))
  }
  function closeModal(){ setModal(null); setForm(EMPTY); setVariants([]); setPreview(null); setPriceHistory([]) }
  function openQuickEdit(p) {
    setQForm({ sku:p.sku, name:p.name, price:p.price, active:p.active??true, linked_modifiers:p.linked_modifiers||[] })
    setQuickEdit(p)
  }
  async function saveQuickEdit() {
    setQSaving(true)
    await supabase.from("products").update({
      name: qForm.name, price: parseFloat(qForm.price)||0,
      active: qForm.active, linked_modifiers: qForm.linked_modifiers
    }).eq("sku", qForm.sku)
    setProducts(prev => prev.map(p => p.sku===qForm.sku ? {...p,...qForm,price:parseFloat(qForm.price)||0} : p))
    setQSaving(false); setQuickEdit(null)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const ext  = file.name.split(".").pop()
      const path = `products/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert:true, contentType:file.type })
      if (error) {
        if (error.message?.includes('Bucket not found') || error.statusCode === '404' || error.error === 'Bucket not found') {
          throw new Error('Storage bucket belum dibuat. Jalankan migrasi SQL berikut di Supabase:\nINSERT INTO storage.buckets (id, name, public) VALUES (\'product-images\', \'product-images\', true);')
        }
        throw error
      }
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path)
      setForm(f => ({ ...f, image_url: publicUrl }))
    } catch (err) { alert("Upload failed: " + err.message); setPreview(form.image_url||null) }
    setUploading(false)
  }

  async function save() {
    if (!form.name || !form.price) return
    setSaving(true)
    const payload = {
      name:           form.name.trim(),
      cat:            form.cat,
      price:          parseInt(form.price) || 0,
      cogs:           parseInt(form.cogs) || 0,
      desc:           form.desc || null,
      icon:           form.icon || "🍽",
      active:         form.active !== false,
      image_url:      form.image_url || null,
      variants:       variants,
      is_consignment: form.is_consignment || false,
      linked_modifiers: form.linked_modifiers || [],
    }
    if (modal === "add") {
      const sku = (form.cat||"PRD").slice(0,3).toUpperCase().replace(/\s/g,"") + Date.now().toString().slice(-6)
      await supabase.from("products").insert({ ...payload, sku })
    } else {
      const existing = products.find(p => p.sku === form.sku)
      if (existing && existing.price !== parseInt(form.price)) {
        supabase.from("price_history").insert({
          sku: form.sku,
          product_name: existing.name,
          old_price: existing.price,
          new_price: parseInt(form.price),
          changed_by: "Backoffice",
        }).catch(() => {})
      }
      await supabase.from("products").update(payload).eq("sku", form.sku)
    }
    await load(); closeModal(); setSaving(false)
  }

  async function toggleActive(p) {
    await supabase.from("products").update({ active: !p.active }).eq("sku", p.sku)
    setProducts(prev => prev.map(x => x.sku === p.sku ? { ...x, active: !x.active } : x))
  }

  async function deleteProduct(sku) {
    if (!confirm("Delete this product?")) return
    await supabase.from("products").delete().eq("sku", sku)
    setProducts(prev => prev.filter(p => p.sku !== sku))
    closeModal()
  }

  async function syncToPOS() {
    setSyncing(true)
    const { error } = await supabase.channel("pos_products_sync").send({ type:"broadcast", event:"force_sync", payload:{ ts: Date.now() } })
    setSyncing(false)
    if (error) alert("Push failed: " + error.message)
    else alert("Pushed to POS ✓")
  }

  // ── Variant helpers ──
  function addVariant() { setVariants(v => [...v, { name:"", price:"", sku:"" }]) }
  function removeVariant(i) { setVariants(v => v.filter((_,idx)=>idx!==i)) }
  function updateVariant(i,k,val) { setVariants(v => v.map((x,idx)=>idx===i?{...x,[k]:val}:x)) }

  // ── Render ──
  const withRecipe = products.filter(p => hasRecipe(p)).length

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display:"flex", gap:20, padding:"10px 16px", background:"#fff", border:"1px solid var(--surface3)", borderRadius:"var(--r-xl)", marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ fontSize:13, color:"var(--ink4)" }}><strong style={{ color:"var(--ink)" }}>{products.length}</strong> total</span>
        <span style={{ fontSize:13, color:"var(--ink4)" }}><strong style={{ color:"var(--green)" }}>{products.filter(p=>p.active).length}</strong> active</span>
        <span style={{ fontSize:13, color:"var(--ink4)" }}><strong style={{ color:"var(--ink5)" }}>{products.filter(p=>!p.active).length}</strong> hidden</span>
        <span style={{ fontSize:13, color:"var(--ink4)" }}><strong style={{ color:"var(--brand)" }}>{withRecipe}</strong> with recipe</span>
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--ink5)", fontSize:14 }}>⌕</span>
          <input placeholder="Search products or SKU..." value={search} onChange={e=>setSearch(e.target.value)}
            className="bo-input" style={{ paddingLeft:30, width:220 }} />
        </div>
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="bo-select" style={{ maxWidth:180 }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
        {/* View toggle */}
        <div style={{ display:"flex", border:"1px solid var(--surface3)", borderRadius:"var(--r)", overflow:"hidden" }}>
          <button onClick={()=>setViewMode("grid")} style={{ padding:"7px 12px", background:viewMode==="grid"?"var(--brand)":"#fff", color:viewMode==="grid"?"#fff":"var(--ink4)", border:"none", cursor:"pointer", fontSize:16 }} title="Grid">⊞</button>
          <button onClick={()=>setViewMode("list")} style={{ padding:"7px 12px", background:viewMode==="list"?"var(--brand)":"#fff", color:viewMode==="list"?"#fff":"var(--ink4)", border:"none", cursor:"pointer", fontSize:16 }} title="List">☰</button>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={syncToPOS} disabled={syncing} className="bo-btn bo-btn-ghost">
            {syncing ? "Syncing…" : "↻ Sync to POS"}
          </button>
          <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Product</button>
        </div>
      </div>
      {selected.size > 0 && (
        <div style={{display:"flex",gap:8,alignItems:"center",padding:"8px 12px",background:"var(--brand-lt)",borderRadius:10,border:"1px solid var(--brand)",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:700,color:"var(--brand)"}}>{selected.size} selected</span>
          <button onClick={()=>{setBulkMods([]); setBulkModal(true)}} className="bo-btn bo-btn-primary bo-btn-sm">Assign Modifiers</button>
          <button onClick={()=>setSelected(new Set())} className="bo-btn bo-btn-ghost bo-btn-sm">Clear</button>
        </div>
      )}

      {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (

        viewMode === "grid" ? (
          /* ── GRID VIEW ── */
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12 }}>
            {filtered.map(p => {
              const color  = getCatColor(p.cat)
              const m      = margin(p)
              const recipe = hasRecipe(p)
              return (
                <div key={p.sku} style={{ background:"#fff", border:"1.5px solid "+(selected.has(p.sku)?"var(--brand)":"var(--surface3)"), borderRadius:16, overflow:"hidden", opacity:p.active?1:0.65, position:"relative" }}>
                  <input type="checkbox" checked={selected.has(p.sku)} onChange={()=>toggleSelect(p.sku)} style={{position:"absolute",top:8,left:8,width:16,height:16,accentColor:"var(--brand)",cursor:"pointer",zIndex:1}} />
                  <div style={{ height:90, background: color+"22", borderBottom:"2px solid "+color+"33", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : <span style={{ fontSize:40 }}>{getCatIcon(p.cat)||p.icon||"🍽"}</span>
                    }
                    {!p.active && <span style={{ position:"absolute", top:6, left:6, fontSize:10, fontWeight:700, background:"var(--amber-lt)", color:"var(--amber)", padding:"2px 7px", borderRadius:10 }}>Hidden</span>}
                    {recipe && <span style={{ position:"absolute", top:6, right:6, fontSize:14 }}>📖</span>}
                  </div>
                  <div style={{ padding:"10px 12px" }}>
                    <div style={{ fontSize:13, fontWeight:800, color:"var(--ink)", lineHeight:1.3 }}>{p.name}</div>
                    <div style={{ fontSize:10, color:"var(--ink5)", marginTop:1 }}>{p.sku}</div>
                    <div style={{ display:"inline-block", fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, background:color+"18", color:color, marginTop:4 }}>{p.cat}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:"var(--brand)", marginTop:4 }}>{fmt(p.price)}</div>
                    {m !== null
                      ? <div style={{ fontSize:10, fontWeight:700, color: m>=65?"var(--green)":m>=45?"var(--amber)":"var(--red)" }}>{m}% margin</div>
                      : <div style={{ fontSize:10, color:"var(--ink5)" }}>No recipe</div>
                    }
                  </div>
                  <div style={{ display:"flex", borderTop:"1px solid var(--surface3)" }}>
                    <button onClick={()=>openQuickEdit(p)} style={{ flex:1, padding:"7px 0", fontSize:11, fontWeight:600, color:"var(--brand)", background:"none", border:"none", borderRight:"1px solid var(--surface3)", cursor:"pointer" }}>Quick</button>
                    <button onClick={()=>openEdit(p)} style={{ flex:1, padding:"7px 0", fontSize:11, fontWeight:600, color:"var(--ink4)", background:"none", border:"none", borderRight:"1px solid var(--surface3)", cursor:"pointer" }}>Edit</button>
                    <button onClick={()=>openEdit(p)} style={{ flex:1, padding:"7px 0", fontSize:11, fontWeight:600, color:"var(--brand)", background:"none", border:"none", borderRight:"1px solid var(--surface3)", cursor:"pointer" }}>Recipe</button>
                    <button onClick={()=>toggleActive(p)} style={{ flex:1, padding:"7px 0", fontSize:11, fontWeight:600, color: p.active?"var(--amber)":"var(--green)", background:"none", border:"none", cursor:"pointer" }}>{p.active?"Hide":"Show"}</button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <div style={{ gridColumn:"1/-1", textAlign:"center", padding:48, color:"var(--ink5)" }}>No products found</div>}
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <>
          {/* Mobile card list — visible on small screens, hidden on desktop via CSS */}
          <div className="bo-products-mobile-list">
            {filtered.map(p => {
              const color  = getCatColor(p.cat)
              const m      = margin(p)
              const recipe = hasRecipe(p)
              return (
                <div key={p.sku + "-m"} className="bo-product-mobile-row">
                  {/* Image / icon */}
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} style={{ width:44, height:44, borderRadius:8, objectFit:"cover", flexShrink:0 }} />
                    : <span style={{ fontSize:28, flexShrink:0, width:44, textAlign:"center" }}>{getCatIcon(p.cat)||p.icon||"🍽"}</span>
                  }
                  {/* Info */}
                  <div className="bo-product-mobile-row-info">
                    <div style={{ fontWeight:700, fontSize:13, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                    <div style={{ display:"flex", gap:5, alignItems:"center", marginTop:3, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:10, background:color+"18", color }}>{p.cat||"-"}</span>
                      <span style={{ fontSize:12, fontWeight:800, color:"var(--brand)" }}>{fmt(p.price)}</span>
                      {m !== null && <span style={{ fontSize:10, fontWeight:700, color: m>=65?"var(--green)":m>=45?"var(--amber)":"var(--red)" }}>{m}%</span>}
                      {!p.active && <span style={{ fontSize:10, fontWeight:700, color:"var(--amber)" }}>Hidden</span>}
                      {p.is_consignment && <span style={{ fontSize:9, fontWeight:700, color:"#6D28D9" }}>Consign</span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="bo-product-mobile-actions">
                    <button onClick={()=>openQuickEdit(p)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ fontSize:11, color:"var(--brand)", padding:"4px 8px" }}>Edit</button>
                    <button onClick={()=>openEdit(p)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ fontSize:11, padding:"4px 8px" }}>Detail</button>
                    <button onClick={()=>deleteProduct(p.sku)} className="bo-btn bo-btn-danger bo-btn-sm" style={{ fontSize:11, padding:"4px 8px" }}>✕</button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <div style={{ textAlign:"center", color:"var(--ink5)", padding:"40px 16px" }}>No products found</div>}
          </div>

          {/* Desktop table — hidden on mobile via CSS */}
          <div className="bo-products-table-wrap bo-card" style={{ padding:0, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table className="bo-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>COGS</th>
                  <th>Margin</th>
                  <th>Recipe</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const color  = getCatColor(p.cat)
                  const m      = margin(p)
                  const recipe = hasRecipe(p)
                  return (
                    <tr key={p.sku} style={{ opacity: p.active ? 1 : 0.55 }}>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} style={{ width:36, height:36, borderRadius:8, objectFit:"cover", flexShrink:0 }} />
                            : <span style={{ fontSize:24, flexShrink:0 }}>{getCatIcon(p.cat)||p.icon||"🍽"}</span>
                          }
                          <div>
                            <div style={{ fontWeight:700, color:"var(--ink)" }}>{p.name}</div>
                            {p.desc && <div style={{ fontSize:11, color:"var(--ink5)" }}>{p.desc}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily:"monospace", fontSize:11, color:"var(--ink5)" }}>{p.sku}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:color+"18", color }}>
                          {p.cat||"-"}
                        </span>
                      </td>
                      <td style={{ fontWeight:700, color:"var(--brand)" }}>{fmt(p.price)}</td>
                      <td style={{ color:"var(--ink3)" }}>{p.cogs>0?fmt(p.cogs):"—"}</td>
                      <td>
                        {m!==null
                          ? <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background: m>=65?"var(--green-lt)":m>=45?"var(--amber-lt)":"var(--red-lt)", color: m>=65?"var(--green)":m>=45?"var(--amber)":"var(--red)" }}>{m}%</span>
                          : <span style={{ color:"var(--ink5)" }}>—</span>
                        }
                      </td>
                      <td>
                        {recipe
                          ? <span className="bo-badge bo-badge-blue">Linked</span>
                          : <span style={{ color:"var(--ink5)", fontSize:12 }}>—</span>
                        }
                      </td>
                      <td>
                        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                          <span className={"bo-badge "+(p.active?"bo-badge-green":"bo-badge-amber")}>
                            {p.active?"Active":"Hidden"}
                          </span>
                          {p.is_consignment && (
                            <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"#EDE9FE", color:"#6D28D9" }}>
                              📦 Consign
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display:"flex", gap:4 }}>
                          <button onClick={()=>openQuickEdit(p)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{color:"var(--brand)"}}>Quick Edit</button>
                          <button onClick={()=>openEdit(p)} className="bo-btn bo-btn-ghost bo-btn-sm">Edit</button>
                          <button onClick={()=>openEdit(p)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ color:"var(--brand)" }}>Recipe</button>
                          <button onClick={()=>deleteProduct(p.sku)} className="bo-btn bo-btn-danger bo-btn-sm">✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign:"center", color:"var(--ink5)", padding:"40px 0" }}>No products found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal" style={{ maxWidth:580, maxHeight:"92vh" }}>
            <div className="bo-modal-header">
              <div>
                <div className="bo-modal-title">{modal==="add"?"Add Product":"Edit Product"}</div>
                {form.sku && <div style={{ fontSize:11, color:"var(--ink5)", marginTop:2 }}>SKU: {form.sku}</div>}
              </div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body" style={{ overflowY:"auto" }}>

              {/* Photo upload */}
              <div className="bo-form-row">
                <label className="bo-label">Product Photo</label>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div onClick={()=>!uploading&&fileRef.current?.click()} style={{ width:80, height:80, borderRadius:12, border:"2px dashed var(--surface3)", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden", flexShrink:0, position:"relative" }}>
                    {preview ? <img src={preview} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:32 }}>{form.icon||"🍽"}</span>}
                    {uploading && <div style={{ position:"absolute", inset:0, background:"rgba(255,255,255,0.85)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--brand)" }}>Uploading…</div>}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading} className="bo-btn bo-btn-ghost bo-btn-sm">{uploading?"Uploading…":preview?"Change Photo":"Upload Photo"}</button>
                    {preview && <button type="button" onClick={()=>{setPreview(null);setForm(f=>({...f,image_url:null}))}} className="bo-btn bo-btn-danger bo-btn-sm">Remove</button>}
                    <span style={{ fontSize:10, color:"var(--ink5)" }}>JPG/PNG · max 2MB</span>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile} />
                </div>
              </div>

              {/* Name */}
              <div style={{ marginBottom:14 }}>
                <label className="bo-label">Product Name *</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" placeholder="Product name" autoFocus />
              </div>

              {/* Category + Price */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label className="bo-label">Category *</label>
                  <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} className="bo-select">
                    <option value="">-- Select --</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="bo-label">Price (Rp) *</label>
                  <input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} className="bo-input" placeholder="e.g. 25000" />
                </div>
              </div>

              {/* Description */}
              <div className="bo-form-row">
                <label className="bo-label">Description</label>
                <textarea value={form.desc||""} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} className="bo-input" placeholder="Optional — shown on digital menu" rows={2} style={{ resize:"vertical" }} />
              </div>

              {/* Available toggle */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <label className="bo-label" style={{ marginBottom:0 }}>Available in POS</label>
                <input type="checkbox" checked={form.active!==false} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--brand)" }} />
              </div>

              {/* Consignment toggle */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, padding:"10px 12px", background: form.is_consignment ? "#F5F3FF" : "var(--surface)", borderRadius:10, border: form.is_consignment ? "1.5px solid #C4B5FD" : "1px solid var(--surface3)" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color: form.is_consignment ? "#6D28D9" : "var(--ink)" }}>📦 Consignment Item</div>
                  <div style={{ fontSize:11, color:"var(--ink5)", marginTop:2 }}>No recipe needed — COGS is set manually. Item sold on behalf of supplier.</div>
                </div>
                <div onClick={()=>setForm(f=>({...f, is_consignment:!f.is_consignment}))}
                  style={{ width:40, height:22, borderRadius:11, background: form.is_consignment ? "#7C3AED" : "var(--surface3)", position:"relative", cursor:"pointer", flexShrink:0, transition:"background 0.2s" }}>
                  <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left: form.is_consignment ? 20 : 2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.25)" }} />
                </div>
              </div>
              {/* Manual COGS for consignment items */}
              {form.is_consignment && (
                <div className="bo-form-row" style={{ marginTop:-8, marginBottom:16 }}>
                  <label className="bo-label">Consignment COGS per item (Rp)</label>
                  <input type="number" value={form.cogs||""} onChange={e=>setForm(f=>({...f,cogs:e.target.value}))} className="bo-input" placeholder="e.g. 20000" />
                  <div style={{ fontSize:11, color:"var(--ink5)", marginTop:4 }}>Amount paid to the supplier per unit sold.</div>
                </div>
              )}

              {/* Variants */}
              <div style={{ borderTop:"1px solid var(--surface3)", paddingTop:14, marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>Variants / Sizes</span>
                  <button onClick={addVariant} className="bo-btn bo-btn-ghost bo-btn-sm">+ Add Variant</button>
                </div>
                {variants.map((v,i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 120px 100px 36px", gap:8, marginBottom:8 }}>
                    <input value={v.name} onChange={e=>updateVariant(i,"name",e.target.value)} className="bo-input" placeholder="Name (e.g. Large)" />
                    <input type="number" value={v.price} onChange={e=>updateVariant(i,"price",e.target.value)} className="bo-input" placeholder="Price" />
                    <input value={v.sku||""} onChange={e=>updateVariant(i,"sku",e.target.value)} className="bo-input" placeholder="SKU" />
                    <button onClick={()=>removeVariant(i)} className="bo-btn bo-btn-danger bo-btn-sm" style={{ padding:"0 10px" }}>✕</button>
                  </div>
                ))}
                {variants.length === 0 && <div style={{ fontSize:12, color:"var(--ink5)" }}>No variants — add sizes or options</div>}
              </div>

              {/* Linked Modifiers */}
              <div style={{ borderTop:"1px solid var(--surface3)", paddingTop:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)", marginBottom:8 }}>Modifiers for this product</div>
                {modifiers.length === 0
                  ? <div style={{ fontSize:12, color:"var(--ink5)" }}>No modifier groups yet — create in Modifiers tab</div>
                  : <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {modifiers.map(m => {
                        const linked = (form.linked_modifiers||[]).includes(m.id)
                        return (
                          <button key={m.id} type="button"
                            onClick={()=>setForm(f=>({ ...f, linked_modifiers: linked ? (f.linked_modifiers||[]).filter(x=>x!==m.id) : [...(f.linked_modifiers||[]), m.id] }))}
                            style={{ fontSize:12, fontWeight:600, padding:"5px 14px", borderRadius:20, cursor:"pointer", fontFamily:"inherit",
                              background: linked ? "var(--brand)" : "var(--surface)",
                              color: linked ? "#fff" : "var(--ink4)",
                              border: linked ? "1.5px solid var(--brand)" : "1.5px solid var(--surface3)" }}>
                            {linked ? "✓ " : ""}{m.name}
                          </button>
                        )
                      })}
                    </div>
                }
                <div style={{ fontSize:11, color:"var(--ink5)", marginTop:6 }}>Selected modifiers will appear when this product is ordered in POS</div>
              </div>
            </div>

            {modal === "edit" && priceHistory.length > 0 && (
              <div style={{ padding:"12px 20px 0" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--ink4)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Price History</div>
                {priceHistory.map(h => (
                  <div key={h.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0", borderBottom:"1px solid var(--surface2)" }}>
                    <span style={{ color:"var(--ink5)" }}>{new Date(h.changed_at).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"})}</span>
                    <span>{fmt(h.old_price)} → <strong>{fmt(h.new_price)}</strong></span>
                    <span style={{ color:"var(--ink5)" }}>{h.changed_by}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bo-modal-footer">
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              {modal === "edit" && (
                <button onClick={()=>deleteProduct(form.sku)} className="bo-btn bo-btn-danger">Delete</button>
              )}
              <button onClick={save} disabled={saving||uploading||!form.name||!form.price} className="bo-btn bo-btn-primary">
                {saving?"Saving...":modal==="add"?"Add Product":"Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      {quickEdit && (
        <div style={{position:"fixed",inset:0,zIndex:500,display:"flex"}}>
          <div onClick={()=>setQuickEdit(null)} style={{flex:1,background:"rgba(0,0,0,0.3)"}} />
          <div style={{width:320,background:"#fff",height:"100%",overflowY:"auto",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid var(--surface3)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:15,fontWeight:800}}>Quick Edit</div>
              <button onClick={()=>setQuickEdit(null)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--ink4)",lineHeight:1}}>x</button>
            </div>
            <div style={{padding:"16px 20px",flex:1,display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label className="bo-label">Product Name</label>
                <input value={qForm.name||""} onChange={e=>setQForm(f=>({...f,name:e.target.value}))} className="bo-input" />
              </div>
              <div>
                <label className="bo-label">Price (Rp)</label>
                <input type="number" value={qForm.price||""} onChange={e=>setQForm(f=>({...f,price:e.target.value}))} className="bo-input" />
              </div>
              <div>
                <label className="bo-label">Status</label>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  {[true,false].map(v => (
                    <button key={String(v)} onClick={()=>setQForm(f=>({...f,active:v}))}
                      style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid "+(qForm.active===v?"var(--brand)":"var(--surface3)"),
                        background:qForm.active===v?"var(--brand-lt)":"#fff",color:qForm.active===v?"var(--brand)":"var(--ink4)",
                        fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                      {v ? "Active" : "Hidden"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="bo-label">Modifiers</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                  {modifiers.length === 0 && <div style={{fontSize:12,color:"var(--ink5)"}}>No modifiers yet</div>}
                  {modifiers.map(m => {
                    const linked = (qForm.linked_modifiers||[]).includes(m.id)
                    return (
                      <button key={m.id} onClick={()=>setQForm(f=>({...f,linked_modifiers:linked?(f.linked_modifiers||[]).filter(x=>x!==m.id):[...(f.linked_modifiers||[]),m.id]}))}
                        style={{fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:20,cursor:"pointer",fontFamily:"inherit",
                          background:linked?"var(--brand)":"var(--surface)",color:linked?"#fff":"var(--ink4)",
                          border:linked?"1.5px solid var(--brand)":"1.5px solid var(--surface3)"}}>
                        {linked ? "v " : ""}{m.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div style={{padding:"16px 20px",borderTop:"1px solid var(--surface3)"}}>
              <button onClick={saveQuickEdit} disabled={qSaving} className="bo-btn bo-btn-primary" style={{width:"100%"}}>
                {qSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkModal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setBulkModal(false)}>
          <div className="bo-modal" style={{maxWidth:480}}>
            <div className="bo-modal-header">
              <div><div className="bo-modal-title">Assign Modifiers</div><div style={{fontSize:11,color:"var(--ink5)"}}>Applies to {selected.size} selected products</div></div>
              <button className="bo-modal-close" onClick={()=>setBulkModal(false)}>x</button>
            </div>
            <div className="bo-modal-body">
              <div style={{fontSize:12,color:"var(--ink4)",marginBottom:12}}>Select modifiers. This replaces existing modifier assignments.</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {modifiers.map(m => {
                  const on = bulkMods.includes(m.id)
                  return (
                    <button key={m.id} onClick={()=>setBulkMods(prev=>on?prev.filter(x=>x!==m.id):[...prev,m.id])}
                      style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(on?"var(--brand)":"var(--surface3)"),background:on?"var(--brand)":"#fff",color:on?"#fff":"var(--ink4)",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                      {on?"v ":""}{m.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setBulkModal(false)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={saveBulkModifiers} disabled={bulkSaving} className="bo-btn bo-btn-primary">{bulkSaving?"Saving...":"Apply to "+selected.size+" products"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
