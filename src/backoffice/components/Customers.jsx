import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("en-US") }

function tierInfo(points) {
  if (points >= 5000) return { label:"Gold",   color:"#FF8B00", bg:"#FFF7E6", next:null,       nextPts:0 }
  if (points >= 1000) return { label:"Silver", color:"#6B778C", bg:"#F4F5F7", next:"Gold",     nextPts:5000 }
  return                     { label:"Bronze", color:"#E65100", bg:"#FFF3E0", next:"Silver",   nextPts:1000 }
}

function pctToNext(points) {
  if (points >= 5000) return 100
  if (points >= 1000) return Math.round(((points-1000)/4000)*100)
  return Math.round((points/1000)*100)
}

const EMPTY = { name:"", phone:"", dob:"", notes:"" }

export default function Customers() {
  const [customers,  setCustomers]  = useState([])
  const [search,     setSearch]     = useState("")
  const [tierFilter, setTierFilter] = useState("all")
  const [loading,    setLoading]    = useState(true)
  const [editing,    setEditing]    = useState(null)
  const [editForm,   setEditForm]   = useState(EMPTY)
  const [adjPoints,  setAdjPoints]  = useState("")
  const [saving,     setSaving]     = useState(false)
  const [addModal,   setAddModal]   = useState(false)
  const [addForm,    setAddForm]    = useState(EMPTY)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("customers").select("*").order("name")
    setCustomers(data||[])
    setLoading(false)
  }

  const gold   = customers.filter(c=>(c.points||0)>=5000)
  const silver = customers.filter(c=>(c.points||0)>=1000&&(c.points||0)<5000)
  const totalRev = customers.reduce((a,c)=>a+(c.totalSpend||c.total_spend||0),0)

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    const t = tierInfo(c.points||0)
    const matchTier = tierFilter==="all" || t.label.toLowerCase()===tierFilter
    return matchSearch && matchTier
  })

  function openEdit(c) {
    setEditForm({ name:c.name||"", phone:c.phone||"", dob:c.dob||"", notes:c.notes||"" })
    setAdjPoints("")
    setEditing(c)
  }

  async function saveEdit() {
    if (!editForm.name) return
    setSaving(true)
    const payload = { name:editForm.name.trim(), phone:editForm.phone||null, dob:editForm.dob||null, notes:editForm.notes||null }
    if (adjPoints !== "" && !isNaN(parseInt(adjPoints))) {
      payload.points = Math.max(0,(editing.points||0)+parseInt(adjPoints))
    }
    await supabase.from("customers").update(payload).eq("id", editing.id)
    await load(); setEditing(null); setSaving(false)
  }

  async function addCustomer() {
    if (!addForm.name) return
    setSaving(true)
    const code = String(customers.length+1).padStart(3,"0")
    await supabase.from("customers").insert({
      id:"CUS-"+Date.now(), name:addForm.name.trim(),
      phone:addForm.phone||null, dob:addForm.dob||null, notes:addForm.notes||null,
      customer_code:code, points:0, visits:0, tier:"Bronze",
      totalSpend:0, join_date:new Date().toISOString().slice(0,10)
    })
    await load(); setAddModal(false); setAddForm(EMPTY); setSaving(false)
  }

  async function deleteCustomer(id) {
    if (!confirm("Delete this customer?")) return
    await supabase.from("customers").delete().eq("id",id)
    setCustomers(prev=>prev.filter(c=>c.id!==id))
    setEditing(null)
  }

  function initials(name) {
    return (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()
  }

  return (
    <div>
      {/* Metrics — plain white boxes */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
        {[
          ["Total Customers", customers.length, "#0052CC"],
          ["Gold Members",    gold.length,       "#FF8B00"],
          ["Silver Members",  silver.length,     "#6554C0"],
          ["Total Revenue",   fmt(totalRev),     "#0052CC"],
        ].map(([label,val,color])=>(
          <div key={label} style={{ background:"#fff", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
            <div style={{ fontSize:28, fontWeight:900, color, letterSpacing:"-1px" }}>{val}</div>
            <div style={{ fontSize:13, color:"#6B778C", marginTop:4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ marginBottom:16 }}>
        {/* Tier filters */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", WebkitOverflowScrolling:"touch", paddingBottom:6, scrollbarWidth:"none" }}>
          {[["all","All"],["gold","Gold"],["silver","Silver"],["bronze","Bronze"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTierFilter(v)}
              style={{ padding:"7px 18px", borderRadius:20, fontSize:13, fontWeight:600, cursor:"pointer",
                border:"1.5px solid "+(tierFilter===v?"var(--brand)":"#DFE1E6"),
                background:tierFilter===v?"var(--brand)":"#fff",
                color:tierFilter===v?"#fff":"#42526E" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:8, flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:140 }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#6B778C", fontSize:14 }}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers..." className="bo-input" style={{ paddingLeft:30, width:"100%" }} />
          </div>
          <button onClick={()=>setAddModal(true)} className="bo-btn bo-btn-primary" style={{ flexShrink:0 }}>+ Add</button>
          <button className="bo-btn bo-btn-ghost" style={{ flexShrink:0 }}>📣</button>
        </div>
      </div>

      {/* Customer Cards Grid */}
      {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
          {filtered.map(c => {
            const t    = tierInfo(c.points||0)
            const pct  = pctToNext(c.points||0)
            const spent = c.totalSpend || c.total_spend || 0
            const last  = c.last_visit ? c.last_visit.slice(0,10) : (c.join_date||"—")
            return (
              <div key={c.id} style={{ background:"#fff", borderRadius:14, padding:"16px", border:"1.5px solid #f0f0f0", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:"#E65100", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:"#fff", flexShrink:0 }}>
                    {initials(c.name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:14, color:"#0A1628", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</div>
                    <div style={{ fontSize:12, color:"#6B778C" }}>{c.customer_code||c.phone||"—"}</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:t.bg, color:t.color, flexShrink:0 }}>{t.label}</span>
                </div>

                {/* Points + progress */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
                  <span style={{ fontSize:18, fontWeight:900, color:"#0A1628" }}>{(c.points||0).toLocaleString("en-US")} pts</span>
                  <span style={{ fontSize:12, color:"#6B778C" }}>{pct}% to next tier</span>
                </div>
                <div style={{ height:4, background:"#f0f0f0", borderRadius:2, marginBottom:12, overflow:"hidden" }}>
                  <div style={{ height:4, width:pct+"%", background:t.color, borderRadius:2 }} />
                </div>

                {/* Stats */}
                <div style={{ fontSize:12, color:"#6B778C", marginBottom:12 }}>
                  {c.visits||0} visits &nbsp;·&nbsp; {fmt(spent)} spent &nbsp;·&nbsp; Last: {last}
                </div>

                {/* Actions */}
                <div style={{ display:"flex", gap:6, borderTop:"1px solid #f0f0f0", paddingTop:12 }}>
                  <button onClick={()=>openEdit(c)} style={{ flex:1, padding:"7px", border:"1.5px solid #DFE1E6", borderRadius:8, background:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", color:"#42526E" }}>Edit</button>
                  <button style={{ flex:1, padding:"7px", border:"1.5px solid #DFE1E6", borderRadius:8, background:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", color:"#42526E" }}>History</button>
                  <button style={{ flex:1, padding:"7px", border:"1.5px solid #DFE1E6", borderRadius:8, background:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", color:"#42526E" }}>Send Voucher</button>
                </div>
              </div>
            )
          })}
          {filtered.length===0 && <div style={{ gridColumn:"1/-1", textAlign:"center", color:"var(--ink5)", padding:48 }}>No customers found</div>}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setEditing(null)}>
          <div className="bo-modal" style={{ maxWidth:480 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">Edit — {editing.name}</div>
              <button className="bo-modal-close" onClick={()=>setEditing(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row"><label className="bo-label">Name *</label><input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} className="bo-input" /></div>
              <div className="bo-form-row"><label className="bo-label">Phone</label><input value={editForm.phone} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} className="bo-input" /></div>
              <div className="bo-form-row"><label className="bo-label">Date of Birth</label><input type="date" value={editForm.dob} onChange={e=>setEditForm(f=>({...f,dob:e.target.value}))} className="bo-input" /></div>
              <div className="bo-form-row"><label className="bo-label">Notes</label><input value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} className="bo-input" /></div>
              <div style={{ marginTop:16, padding:"14px 16px", background:"var(--surface)", borderRadius:"var(--r)", border:"1px solid var(--surface3)" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--ink4)", marginBottom:8 }}>Point Adjustment · Current: {(editing.points||0).toLocaleString("en-US")} pts</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                  {[-500,-100,100,500,1000].map(n=>(
                    <button key={n} type="button" onClick={()=>setAdjPoints(String(n))}
                      className={"bo-btn bo-btn-sm "+(adjPoints===String(n)?(n>0?"bo-btn-primary":"bo-btn-danger"):"bo-btn-ghost")}>
                      {n>0?"+"+n:n}
                    </button>
                  ))}
                </div>
                <input type="number" value={adjPoints} onChange={e=>setAdjPoints(e.target.value)} className="bo-input" placeholder="Custom amount (e.g. +200 or -50)" />
                {adjPoints!==""&&!isNaN(parseInt(adjPoints))&&(
                  <div style={{ fontSize:11, color:"var(--ink5)", marginTop:4 }}>New total: {Math.max(0,(editing.points||0)+parseInt(adjPoints)).toLocaleString("en-US")} pts</div>
                )}
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>deleteCustomer(editing.id)} className="bo-btn bo-btn-danger">Delete</button>
              <button onClick={()=>setEditing(null)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={saveEdit} disabled={saving||!editForm.name} className="bo-btn bo-btn-primary">{saving?"Saving...":"Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setAddModal(false)}>
          <div className="bo-modal" style={{ maxWidth:440 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">Add Customer</div>
              <button className="bo-modal-close" onClick={()=>setAddModal(false)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row"><label className="bo-label">Name *</label><input value={addForm.name} onChange={e=>setAddForm(f=>({...f,name:e.target.value}))} className="bo-input" autoFocus /></div>
              <div className="bo-form-row"><label className="bo-label">Phone</label><input value={addForm.phone} onChange={e=>setAddForm(f=>({...f,phone:e.target.value}))} className="bo-input" /></div>
              <div className="bo-form-row"><label className="bo-label">Date of Birth</label><input type="date" value={addForm.dob} onChange={e=>setAddForm(f=>({...f,dob:e.target.value}))} className="bo-input" /></div>
              <div className="bo-form-row"><label className="bo-label">Notes</label><input value={addForm.notes} onChange={e=>setAddForm(f=>({...f,notes:e.target.value}))} className="bo-input" /></div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setAddModal(false)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={addCustomer} disabled={saving||!addForm.name} className="bo-btn bo-btn-primary">{saving?"Saving...":"Add Customer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
