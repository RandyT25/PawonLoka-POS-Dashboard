import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const EMPTY = { name:"", description:"", price:0, items:[], active:true, image_url:"" }

export default function Bundles() {
  const [bundles,  setBundles]  = useState([])
  const [products, setProducts] = useState([])
  const [modal,    setModal]    = useState(false)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from("bundles").select("*").order("name"),
      supabase.from("products").select("sku,name,price,icon,cat").eq("active", true).order("name")
    ])
    setBundles(b||[])
    setProducts(p||[])
    setLoading(false)
  }

  function openAdd() { setForm(EMPTY); setModal("add") }
  function openEdit(b) { setForm({...b, items: b.items||[]}); setModal("edit") }
  function closeModal() { setModal(false); setForm(EMPTY) }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { sku:"", name:"", qty:1, price:0, free:false }] }))
  }
  function removeItem(i) {
    setForm(f => ({ ...f, items: f.items.filter((_,idx)=>idx!==i) }))
  }
  function updateItem(i, key, val) {
    setForm(f => ({ ...f, items: f.items.map((item,idx) => {
      if (idx !== i) return item
      if (key === "sku") {
        const prod = products.find(p => p.sku === val)
        return { ...item, sku:val, name:prod?.name||"", price:prod?.price||0 }
      }
      return { ...item, [key]: val }
    })}))
  }

  const originalTotal = form.items.filter(i=>!i.free).reduce((s,i)=>s+(i.price*(i.qty||1)),0)
  const savings = Math.max(0, originalTotal - Number(form.price||0))

  async function save() {
    if (!form.name || form.items.length === 0) return alert("Name and at least one item required")
    setSaving(true)
    const payload = { name:form.name, description:form.description||"", price:Number(form.price)||0,
      items:form.items, active:form.active!==false, image_url:form.image_url||"" }
    if (modal === "add") {
      await supabase.from("bundles").insert({ ...payload, id:"BND-"+Date.now() })
    } else {
      await supabase.from("bundles").update(payload).eq("id", form.id)
    }
    await load()
    closeModal()
    setSaving(false)
  }

  async function toggleActive(b) {
    await supabase.from("bundles").update({ active:!b.active }).eq("id", b.id)
    setBundles(prev => prev.map(x => x.id===b.id ? {...x, active:!x.active} : x))
  }

  async function deleteBundle(id) {
    if (!confirm("Delete this bundle?")) return
    await supabase.from("bundles").delete().eq("id", id)
    setBundles(prev => prev.filter(b => b.id !== id))
    closeModal()
  }

  const fmt = n => "Rp "+Math.round(n).toLocaleString("id-ID")
  const filtered = bundles.filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {[["Total Bundles", bundles.length, "#0052CC"],
          ["Active", bundles.filter(b=>b.active).length, "#00875A"],
          ["Inactive", bundles.filter(b=>!b.active).length, "#6B778C"]
        ].map(([l,v,c])=>(
          <div key={l} style={{ background:"#fff", borderRadius:12, padding:"16px 20px", border:"1px solid #f0f0f0" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#6B778C", marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:26, fontWeight:900, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search bundles..." className="bo-input" style={{ flex:1, minWidth:180 }} />
        <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Create Bundle</button>
      </div>

      {/* Bundle cards */}
      {loading ? <div style={{ textAlign:"center", padding:40, color:"var(--ink5)" }}>Loading...</div>
      : filtered.length === 0 ? (
        <div className="bo-card" style={{ textAlign:"center", padding:48 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>No bundles yet</div>
          <div style={{ fontSize:13, color:"#6B778C", marginBottom:16 }}>Create combo meals or package deals with special pricing</div>
          <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Create Bundle</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
          {filtered.map(b => {
            const items = b.items||[]
            const origTotal = items.filter(i=>!i.free).reduce((s,i)=>s+(i.price*(i.qty||1)),0)
            const saving = Math.max(0, origTotal - b.price)
            return (
              <div key={b.id} style={{ background:"#fff", border:"1.5px solid #f0f0f0", borderRadius:16, overflow:"hidden", opacity:b.active?1:0.6 }}>
                <div style={{ padding:"16px 20px", borderBottom:"1px solid #f0f0f0" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:"#0A1628" }}>{b.name}</div>
                      {b.description && <div style={{ fontSize:12, color:"#6B778C", marginTop:2 }}>{b.description}</div>}
                    </div>
                    <span className={"bo-badge "+(b.active?"bo-badge-green":"bo-badge-amber")}>{b.active?"Active":"Off"}</span>
                  </div>
                  <div style={{ marginTop:12 }}>
                    <div style={{ fontSize:22, fontWeight:900, color:"#0052CC" }}>{fmt(b.price)}</div>
                    {saving > 0 && <div style={{ fontSize:11, color:"#00875A", fontWeight:700 }}>Save {fmt(saving)} vs ordering separately</div>}
                  </div>
                </div>
                <div style={{ padding:"12px 20px" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#6B778C", marginBottom:8 }}>INCLUDES</div>
                  {items.map((item,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, marginBottom:4 }}>
                      <span>{item.qty > 1 ? `${item.qty}x ` : ""}{item.name||"Unknown item"}</span>
                      {item.free
                        ? <span style={{ fontSize:11, fontWeight:700, color:"#00875A", background:"#E3FCEF", padding:"1px 6px", borderRadius:6 }}>FREE</span>
                        : <span style={{ color:"#6B778C" }}>{fmt(item.price)}</span>
                      }
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", borderTop:"1px solid #f0f0f0" }}>
                  <button onClick={()=>openEdit(b)} style={{ flex:1, padding:10, fontSize:12, fontWeight:700, color:"var(--brand)", background:"none", border:"none", borderRight:"1px solid #f0f0f0", cursor:"pointer" }}>Edit</button>
                  <button onClick={()=>toggleActive(b)} style={{ flex:1, padding:10, fontSize:12, fontWeight:700, color:b.active?"var(--amber)":"var(--green)", background:"none", border:"none", borderRight:"1px solid #f0f0f0", cursor:"pointer" }}>{b.active?"Disable":"Enable"}</button>
                  <button onClick={()=>deleteBundle(b.id)} style={{ flex:1, padding:10, fontSize:12, fontWeight:700, color:"var(--red)", background:"none", border:"none", cursor:"pointer" }}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal" style={{ maxWidth:600 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Create Bundle":"Edit Bundle"}</div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label className="bo-label">Bundle Name *</label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" placeholder="e.g. Paket Hemat A" autoFocus />
                </div>
                <div>
                  <label className="bo-label">Bundle Price (Rp) *</label>
                  <input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} className="bo-input" placeholder="0" />
                </div>
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Description</label>
                <input value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="bo-input" placeholder="Optional description" />
              </div>

              {/* Items */}
              <div style={{ borderTop:"1px solid var(--surface3)", paddingTop:14, marginTop:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:13, fontWeight:800 }}>Bundle Items</div>
                  <button onClick={addItem} className="bo-btn bo-btn-ghost bo-btn-sm">+ Add Item</button>
                </div>
                {form.items.length === 0 && (
                  <div style={{ textAlign:"center", padding:"20px 0", color:"var(--ink5)", fontSize:12 }}>No items yet. Click "+ Add Item" to add dishes.</div>
                )}
                {form.items.map((item, i) => (
                  <div key={i} style={{ background:"var(--surface)", borderRadius:10, padding:"10px 12px", marginBottom:8, border:"1px solid var(--surface3)" }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                      <div style={{ flex:1, position:"relative" }}>
                        <input
                          value={item.name || ""}
                          onChange={e => {
                            const q = e.target.value.toLowerCase()
                            setForm(f => ({ ...f, _itemSearch: { ...f._itemSearch, [i]: q } }))
                            updateItem(i, "name", e.target.value)
                          }}
                          onFocus={() => setForm(f=>({...f,_itemSearch:{...f._itemSearch,[i]:item.name||""}}))}
                          className="bo-input" placeholder="Search dish..." />
                        {form._itemSearch?.[i] !== undefined && (
                          <div style={{ position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1.5px solid var(--brand)",borderRadius:10,zIndex:100,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.12)" }}>
                            {products.filter(p=>p.name.toLowerCase().includes((form._itemSearch[i]||"").toLowerCase())).slice(0,10).map(p=>(
                              <div key={p.sku} onClick={()=>{updateItem(i,"sku",p.sku); setForm(f=>{const s={...f._itemSearch};delete s[i];return{...f,_itemSearch:s}})}}
                                style={{ padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid #f0f0f0",fontSize:13 }}
                                onMouseEnter={e=>e.currentTarget.style.background="#f0f4ff"}
                                onMouseLeave={e=>e.currentTarget.style.background=""}>
                                {p.icon||"🍽"} {p.name} <span style={{color:"var(--ink5)",fontSize:11}}>— {fmt(p.price)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={()=>removeItem(i)} style={{ background:"none", border:"none", color:"var(--red)", cursor:"pointer", fontSize:18, flexShrink:0 }}>✕</button>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <div style={{ flex:1 }}>
                        <label className="bo-label">Qty</label>
                        <input type="number" min={1} value={item.qty||1} onChange={e=>updateItem(i,"qty",parseInt(e.target.value)||1)} className="bo-input" />
                      </div>
                      <div style={{ flex:1 }}>
                        <label className="bo-label">Price (override)</label>
                        <input type="number" value={item.price||0} onChange={e=>updateItem(i,"price",e.target.value)} className="bo-input" />
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                        <label className="bo-label">FREE?</label>
                        <input type="checkbox" checked={!!item.free} onChange={e=>updateItem(i,"free",e.target.checked)} style={{ width:18, height:18, accentColor:"var(--green)" }} />
                      </div>
                    </div>
                  </div>
                ))}

                {form.items.length > 0 && (
                  <div style={{ background:"var(--brand-lt)", borderRadius:10, padding:"10px 14px", marginTop:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ color:"var(--ink4)" }}>Original total</span>
                      <span style={{ fontWeight:700 }}>{fmt(originalTotal)}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ color:"var(--ink4)" }}>Bundle price</span>
                      <span style={{ fontWeight:700, color:"var(--brand)" }}>{fmt(form.price||0)}</span>
                    </div>
                    {savings > 0 && (
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:800 }}>
                        <span style={{ color:"var(--green)" }}>Customer saves</span>
                        <span style={{ color:"var(--green)" }}>{fmt(savings)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:14 }}>
                <input type="checkbox" checked={form.active!==false} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--brand)" }} />
                <span style={{ fontSize:13, fontWeight:600 }}>Active (visible in POS)</span>
              </label>
            </div>
            <div className="bo-modal-footer">
              {modal==="edit" && <button onClick={()=>deleteBundle(form.id)} className="bo-btn bo-btn-danger">Delete</button>}
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving||!form.name} className="bo-btn bo-btn-primary">{saving?"Saving...":modal==="add"?"Create Bundle":"Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
