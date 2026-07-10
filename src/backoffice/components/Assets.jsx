import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("en-US") }
const ASSET_CATEGORIES = ["Equipment","Furniture","Renovation","Vehicle","Electronics","Other"]
const CAT_COLORS = { Equipment:"var(--brand)", Furniture:"var(--amber)", Renovation:"#6554C0", Vehicle:"var(--green)", Electronics:"#00B8D9", Other:"var(--ink5)" }
const EMPTY = { name:"", category:"Equipment", amount:"", acquired_date:new Date().toISOString().slice(0,10), notes:"" }

export default function Assets() {
  const [assets,  setAssets]  = useState([])
  const [modal,   setModal]   = useState(null)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("assets").select("*").order("acquired_date", { ascending:false })
    setAssets(data||[])
    setLoading(false)
  }

  function openAdd()   { setForm(EMPTY); setModal("add") }
  function openEdit(a) { setForm({...a}); setModal("edit") }
  function closeModal(){ setModal(null); setForm(EMPTY) }

  async function save() {
    if (!form.name || !form.amount) return
    setSaving(true)
    const payload = {
      name:form.name.trim(), category:form.category||"Other",
      amount:parseFloat(form.amount)||0, acquired_date:form.acquired_date||new Date().toISOString().slice(0,10),
      notes:form.notes||null, updated_at:new Date().toISOString(),
    }
    if (modal==="add") await supabase.from("assets").insert(payload)
    else await supabase.from("assets").update(payload).eq("id", form.id)
    await load(); closeModal(); setSaving(false)
  }

  async function deleteAsset(id) {
    if (!confirm("Delete this asset record?")) return
    await supabase.from("assets").delete().eq("id", id)
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  const totalInvested = assets.reduce((a,x)=>a+(x.amount||0),0)

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12 }}>
        <div className="bo-card" style={{ margin:0, padding:"14px 20px", display:"flex", gap:24, alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--ink4)", textTransform:"uppercase" }}>Total Invested</div>
            <div style={{ fontSize:22, fontWeight:900, color:"var(--brand)" }}>{fmt(totalInvested)}</div>
          </div>
          <div style={{ fontSize:12, color:"var(--ink4)" }}>{assets.length} asset{assets.length!==1?"s":""}</div>
        </div>
        <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Asset</button>
      </div>

      <div className="bo-card" style={{ padding:0, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
          <table className="bo-table">
            <thead><tr><th>Date</th><th>Name</th><th>Category</th><th>Amount</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              {assets.map(a => {
                const c = CAT_COLORS[a.category] || "var(--ink5)"
                return (
                  <tr key={a.id}>
                    <td style={{ fontSize:12, color:"var(--ink4)" }}>{a.acquired_date}</td>
                    <td style={{ fontWeight:700 }}>{a.name}</td>
                    <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:c+"22", color:c }}>{a.category}</span></td>
                    <td style={{ fontWeight:700 }}>{fmt(a.amount)}</td>
                    <td style={{ fontSize:12, color:"var(--ink4)", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.notes||"—"}</td>
                    <td>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>openEdit(a)} className="bo-btn bo-btn-ghost bo-btn-sm">Edit</button>
                        <button onClick={()=>deleteAsset(a.id)} className="bo-btn bo-btn-danger bo-btn-sm">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {assets.length===0 && <tr><td colSpan={6} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>No assets yet. Click + Add Asset.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal">
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Add Asset":"Edit Asset"}</div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row"><label className="bo-label">Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" autoFocus placeholder="e.g. Kulkas 2 Pintu" /></div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Category</label>
                  <select value={form.category||"Equipment"} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="bo-select">
                    {ASSET_CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="bo-label">Amount Paid *</label><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} className="bo-input" placeholder="0" /></div>
              </div>
              <div className="bo-form-row"><label className="bo-label">Date Acquired</label><input type="date" value={form.acquired_date} onChange={e=>setForm(f=>({...f,acquired_date:e.target.value}))} className="bo-input" /></div>
              <div className="bo-form-row"><label className="bo-label">Notes</label><input value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="bo-input" placeholder="Optional" /></div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              {modal==="edit" && <button onClick={()=>deleteAsset(form.id)} className="bo-btn bo-btn-danger">Delete</button>}
              <button onClick={save} disabled={saving||!form.name||!form.amount} className="bo-btn bo-btn-primary">{saving?"Saving...":modal==="add"?"Add":"Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
