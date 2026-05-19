import { useState, useEffect } from "react"
import { supabase } from "../../../lib/supabase"

const EMPTY = { name:"", contact:"", phone:"", email:"", address:"", payment_terms:"Net 30", active:true }

export default function InvSuppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [modal,     setModal]     = useState(null)
  const [form,      setForm]      = useState(EMPTY)
  const [saving,    setSaving]    = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("suppliers").select("*").order("name")
    setSuppliers(data||[])
    setLoading(false)
  }

  function openAdd()   { setForm(EMPTY); setModal("add") }
  function openEdit(s) { setForm({...s}); setModal("edit") }
  function closeModal(){ setModal(null); setForm(EMPTY) }

  async function save() {
    if (!form.name) return
    setSaving(true)
    const payload = { name:form.name.trim(), contact:form.contact||null, phone:form.phone||null, email:form.email||null, address:form.address||null, payment_terms:form.payment_terms||"Net 30", active:form.active!==false }
    if (modal==="add") await supabase.from("suppliers").insert({ ...payload, id:"SUP-"+Date.now() })
    else await supabase.from("suppliers").update(payload).eq("id", form.id)
    await load(); closeModal(); setSaving(false)
  }

  async function toggleActive(s) {
    await supabase.from("suppliers").update({ active:!s.active }).eq("id", s.id)
    setSuppliers(prev => prev.map(x => x.id===s.id?{...x,active:!x.active}:x))
  }

  async function deleteSupplier(id) {
    if (!confirm("Delete this supplier?")) return
    await supabase.from("suppliers").delete().eq("id", id)
    setSuppliers(prev => prev.filter(s=>s.id!==id))
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <span style={{ fontSize:13, color:"var(--ink4)", fontWeight:600 }}>{suppliers.length} suppliers</span>
        <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Supplier</button>
      </div>

      {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ background:"#fff", border:"1.5px solid var(--surface3)", borderRadius:16, overflow:"hidden", opacity:s.active?1:0.6 }}>
              <div style={{ padding:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:800, color:"var(--ink)" }}>{s.name}</div>
                    {s.contact && <div style={{ fontSize:12, color:"var(--ink4)", marginTop:2 }}>👤 {s.contact}</div>}
                  </div>
                  <span className={"bo-badge "+(s.active?"bo-badge-green":"bo-badge-amber")}>{s.active?"Active":"Inactive"}</span>
                </div>
                {s.phone   && <div style={{ fontSize:12, color:"var(--ink4)", marginBottom:2 }}>📞 {s.phone}</div>}
                {s.email   && <div style={{ fontSize:12, color:"var(--ink4)", marginBottom:2 }}>✉️ {s.email}</div>}
                {s.address && <div style={{ fontSize:11, color:"var(--ink5)", marginBottom:2 }}>📍 {s.address}</div>}
                {s.payment_terms && <div style={{ fontSize:11, color:"var(--ink5)" }}>💳 {s.payment_terms}</div>}
              </div>
              <div style={{ display:"flex", borderTop:"1px solid var(--surface3)" }}>
                <button onClick={()=>openEdit(s)} style={{ flex:1, padding:9, fontSize:12, fontWeight:600, color:"var(--ink4)", background:"none", border:"none", borderRight:"1px solid var(--surface3)", cursor:"pointer" }}>Edit</button>
                <button onClick={()=>toggleActive(s)} style={{ flex:1, padding:9, fontSize:12, fontWeight:600, color:s.active?"var(--amber)":"var(--green)", background:"none", border:"none", borderRight:"1px solid var(--surface3)", cursor:"pointer" }}>{s.active?"Deactivate":"Activate"}</button>
                <button onClick={()=>deleteSupplier(s.id)} style={{ flex:1, padding:9, fontSize:12, fontWeight:600, color:"var(--red)", background:"none", border:"none", cursor:"pointer" }}>Delete</button>
              </div>
            </div>
          ))}
          {suppliers.length===0 && <div style={{ gridColumn:"1/-1", textAlign:"center", color:"var(--ink5)", padding:40 }}>No suppliers yet</div>}
        </div>
      )}

      {modal && (
        <div className="bo-overlay" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal">
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Add Supplier":"Edit Supplier"}</div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row"><label className="bo-label">Supplier Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" autoFocus /></div>
              <div className="bo-form-row"><label className="bo-label">Contact Person</label><input value={form.contact||""} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} className="bo-input" /></div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Phone</label><input value={form.phone||""} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="bo-input" /></div>
                <div><label className="bo-label">Email</label><input value={form.email||""} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="bo-input" /></div>
              </div>
              <div className="bo-form-row"><label className="bo-label">Address</label><input value={form.address||""} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className="bo-input" /></div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Payment Terms</label>
                  <select value={form.payment_terms||"Net 30"} onChange={e=>setForm(f=>({...f,payment_terms:e.target.value}))} className="bo-select">
                    <option>Cash on Delivery</option><option>Net 7</option><option>Net 14</option><option>Net 30</option><option>Net 60</option>
                  </select>
                </div>
                <div style={{ paddingTop:22 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                    <input type="checkbox" checked={form.active!==false} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--brand)" }} />
                    <span style={{ fontSize:13, fontWeight:600 }}>Active</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving||!form.name} className="bo-btn bo-btn-primary">{saving?"Saving...":modal==="add"?"Add Supplier":"Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
