
import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }

const EMPTY = { name:"", category:"", price:"", description:"", icon:"🍽", available:true }

export default function Products() {
  const [products, setProducts]   = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch]       = useState("")
  const [catFilter, setCatFilter] = useState("all")
  const [modal, setModal]         = useState(null)  // null | "add" | "edit"
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products").select("*").order("category").order("name"),
      supabase.from("categories").select("*").order("name"),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
    setLoading(false)
  }

  const filtered = products.filter(p => {
    const matchCat = catFilter === "all" || p.category === catFilter
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  function openAdd() { setForm(EMPTY); setModal("add") }
  function openEdit(p) { setForm({ ...p, price: String(p.price) }); setModal("edit") }
  function closeModal() { setModal(null); setForm(EMPTY) }

  async function save() {
    if (!form.name || !form.price) return
    setSaving(true)
    const payload = {
      name:        form.name.trim(),
      category:    form.category,
      price:       parseInt(form.price) || 0,
      description: form.description || null,
      icon:        form.icon || "🍽",
      available:   form.available !== false,
    }
    if (modal === "add") {
      await supabase.from("products").insert({ ...payload, id: "PROD-" + Date.now() })
    } else {
      await supabase.from("products").update(payload).eq("id", form.id)
    }
    await load()
    closeModal()
    setSaving(false)
  }

  async function toggleAvailable(p) {
    await supabase.from("products").update({ available: !p.available }).eq("id", p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, available: !x.available } : x))
  }

  async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return
    await supabase.from("products").delete().eq("id", id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <input
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bo-input"
          style={{ maxWidth:240 }}
        />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="bo-select" style={{ maxWidth:180 }}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <div style={{ marginLeft:"auto" }}>
          <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Product</button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display:"flex", gap:20, padding:"10px 16px", background:"#fff", border:"1px solid var(--surface3)", borderRadius:"var(--r-xl)", marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:"var(--ink4)" }}>Total: <strong style={{ color:"var(--ink)" }}>{products.length}</strong></span>
        <span style={{ fontSize:12, color:"var(--ink4)" }}>Active: <strong style={{ color:"var(--green)" }}>{products.filter(p=>p.available).length}</strong></span>
        <span style={{ fontSize:12, color:"var(--ink4)" }}>Hidden: <strong style={{ color:"var(--ink5)" }}>{products.filter(p=>!p.available).length}</strong></span>
        <span style={{ fontSize:12, color:"var(--ink4)" }}>Showing: <strong style={{ color:"var(--ink)" }}>{filtered.length}</strong></span>
      </div>

      {/* Table */}
      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>
        ) : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ opacity: p.available ? 1 : 0.55 }}>
                  <td>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:22 }}>{p.icon || "🍽"}</span>
                      <div>
                        <div style={{ fontWeight:700, color:"var(--ink)" }}>{p.name}</div>
                        {p.description && <div style={{ fontSize:11, color:"var(--ink5)", marginTop:1 }}>{p.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="bo-badge bo-badge-blue">{p.category || "-"}</span>
                  </td>
                  <td style={{ fontWeight:700, color:"var(--brand)" }}>{fmt(p.price)}</td>
                  <td>
                    <span className={"bo-badge " + (p.available ? "bo-badge-green" : "bo-badge-amber")}>
                      {p.available ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => openEdit(p)} className="bo-btn bo-btn-ghost bo-btn-sm">Edit</button>
                      <button onClick={() => toggleAvailable(p)} className="bo-btn bo-btn-ghost bo-btn-sm">
                        {p.available ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="bo-btn bo-btn-danger bo-btn-sm">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>No products found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="bo-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="bo-modal">
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal === "add" ? "Add Product" : "Edit Product"}</div>
              <button className="bo-modal-close" onClick={closeModal}>x</button>
            </div>
            <div className="bo-modal-body">
              <div style={{ display:"grid", gridTemplateColumns:"64px 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label className="bo-label">Icon</label>
                  <input value={form.icon} onChange={e => setForm(f=>({...f, icon:e.target.value}))} className="bo-input" style={{ textAlign:"center", fontSize:24, padding:"6px" }} />
                </div>
                <div>
                  <label className="bo-label">Name *</label>
                  <input value={form.name} onChange={e => setForm(f=>({...f, name:e.target.value}))} className="bo-input" placeholder="Product name" autoFocus />
                </div>
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Category</label>
                <select value={form.category} onChange={e => setForm(f=>({...f, category:e.target.value}))} className="bo-select">
                  <option value="">-- Select category --</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Price (Rp) *</label>
                <input type="number" value={form.price} onChange={e => setForm(f=>({...f, price:e.target.value}))} className="bo-input" placeholder="e.g. 25000" />
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Description</label>
                <input value={form.description || ""} onChange={e => setForm(f=>({...f, description:e.target.value}))} className="bo-input" placeholder="Optional description" />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <label className="bo-label" style={{ marginBottom:0 }}>Available in POS</label>
                <input type="checkbox" checked={form.available !== false} onChange={e => setForm(f=>({...f, available:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--brand)" }} />
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.price} className="bo-btn bo-btn-primary">
                {saving ? "Saving..." : modal === "add" ? "Add Product" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
