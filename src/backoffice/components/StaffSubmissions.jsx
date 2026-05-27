import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }
const TYPE_COLORS = { opname:"var(--brand)", waste:"var(--red)", production:"var(--green)", requisition:"#6554C0" }
const TYPE_ICONS  = { opname:"📋", waste:"🗑️", production:"🏭", requisition:"🛒" }
const TYPE_LABELS = { opname:"Stock Count", waste:"Waste", production:"Production", requisition:"Request" }

function IngSearchEdit({ ingredients, onSelect }) {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const filtered = ingredients.filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase())).slice(0,20)
  return (
    <div style={{ position:"relative" }}>
      <input value={q} onChange={e=>{ setQ(e.target.value); setOpen(true) }} onFocus={()=>setOpen(true)}
        className="bo-input" style={{ fontSize:12 }} placeholder="Search ingredient..." />
      {open && filtered.length > 0 && (
        <div style={{ position:"absolute", zIndex:999, top:"100%", left:0, right:0, background:"#fff", border:"1px solid var(--surface3)", borderRadius:8, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", maxHeight:180, overflowY:"auto" }}>
          {filtered.map(ing => (
            <div key={ing.id} onClick={()=>{ onSelect(ing); setQ(ing.name); setOpen(false) }}
              style={{ padding:"8px 12px", fontSize:13, cursor:"pointer", borderBottom:"1px solid var(--surface)" }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--brand-lt)"}
              onMouseLeave={e=>e.currentTarget.style.background=""}>
              {ing.name} <span style={{ fontSize:11, color:"var(--ink4)" }}>{ing.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StaffSubmissions() {
  const [submissions, setSubmissions] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [typeFilter,  setTypeFilter]  = useState("all")
  const [statusFilter,setStatusFilter]= useState("pending")
  const [viewModal,   setViewModal]   = useState(null)
  const [editModal,   setEditModal]   = useState(null)
  const [editData,    setEditData]    = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [processing,  setProcessing]  = useState(false)
  const [newCount,    setNewCount]    = useState(0)
  const audioRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    channelRef.current = supabase
      .channel("staff_submissions_realtime")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"staff_submissions" }, payload => {
        setSubmissions(prev => [payload.new, ...prev])
        setNewCount(n => n + 1)
        // Play notification sound
        try {
          const ctx = new AudioContext()
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.connect(g); g.connect(ctx.destination)
          o.frequency.value = 880; g.gain.value = 0.3
          o.start(); o.stop(ctx.currentTime + 0.15)
          setTimeout(() => { o.frequency.value = 1100; o.start(ctx.currentTime + 0.2); o.stop(ctx.currentTime + 0.35) }, 200)
        } catch(e) {}
      })
      .subscribe()
    return () => { supabase.removeChannel(channelRef.current) }
  }, [])

  async function load() {
    setLoading(true)
    const [{ data:s }, { data:i }] = await Promise.all([
      supabase.from("staff_submissions").select("*").order("submitted_at", { ascending:false }),
      supabase.from("ingredients").select("*"),
    ])
    setSubmissions(s||[]); setIngredients(i||[])
    setLoading(false)
    setNewCount(0)
  }

  const byStatus = (st) => submissions.filter(s => s.status === st)
  const pending  = byStatus("pending")
  const approved = byStatus("approved")
  const rejected = byStatus("rejected")

  const filtered = submissions.filter(s => {
    const matchStatus = statusFilter === "all" || s.status === statusFilter
    const matchType   = typeFilter === "all" || s.type === typeFilter
    return matchStatus && matchType
  })

  function openEdit(sub) {
    setEditData(JSON.parse(JSON.stringify(sub.data)))
    setEditModal(sub)
    setViewModal(null)
  }

  async function saveEdit() {
    await supabase.from("staff_submissions").update({ data: editData }).eq("id", editModal.id)
    setSubmissions(prev => prev.map(s => s.id === editModal.id ? { ...s, data: editData } : s))
    setEditModal(null); setEditData(null)
  }

  async function approve(sub) {
    if (!confirm("Approve and apply this " + sub.type + " report?")) return
    setProcessing(true)
    try {
      if (sub.type==="opname") {
        for (const item of sub.data.items||[]) {
          await supabase.from("ingredients").update({ stock:item.actual_qty }).eq("id",item.ingredient_id)
          await supabase.from("stock_movements").insert({
            id:"MOV-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
            type:"Adjustment", ingredient_id:item.ingredient_id, ingredient_name:item.name,
            qty:item.diff, unit:item.unit, ref:sub.id,
            note:"Staff opname by "+sub.submitted_by,
            date:new Date().toISOString().slice(0,10),
            time:new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
          })
        }
        await supabase.from("stock_opname").insert({
          id:"OPN-"+Date.now(), date:new Date().toISOString().slice(0,10),
          status:"Completed", items:sub.data.items,
          total_variance:sub.data.items.reduce((a,i)=>a+(i.diff*(ingredients.find(x=>x.id===i.ingredient_id)?.cost_per_unit||0)),0)
        })
      } else if (sub.type==="waste") {
        const d = sub.data
        const ing = ingredients.find(i=>i.id===d.ingredient_id)
        if (ing) {
          await supabase.from("ingredients").update({ stock:Math.max(0,(ing.stock||0)-d.qty) }).eq("id",ing.id)
          await supabase.from("waste_records").insert({
            id:"WST-"+Date.now(), date:new Date().toISOString().slice(0,10),
            ingredient_id:d.ingredient_id, ingredient_name:d.ingredient_name,
            qty:d.qty, unit:d.unit, reason:d.reason, cost:d.estimated_cost,
            recorded_by:sub.submitted_by, notes:d.notes||null
          })
          await supabase.from("stock_movements").insert({
            id:"MOV-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
            type:"Waste", ingredient_id:d.ingredient_id, ingredient_name:d.ingredient_name,
            qty:-d.qty, unit:d.unit, ref:sub.id,
            note:"Staff waste by "+sub.submitted_by+": "+d.reason,
            date:new Date().toISOString().slice(0,10),
            time:new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
          })
        }
      } else if (sub.type==="production") {
        const d = sub.data
        const item = ingredients.find(i=>i.id===d.item_id)
        for (const u of d.ingredients_used||[]) {
          const ing = ingredients.find(i=>i.id===u.ingredient_id)
          if (ing) {
            await supabase.from("ingredients").update({ stock:Math.max(0,(ing.stock||0)-u.qty) }).eq("id",ing.id)
            await supabase.from("stock_movements").insert({
              id:"MOV-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
              type:"Production", ingredient_id:ing.id, ingredient_name:ing.name,
              qty:-u.qty, unit:u.unit, ref:sub.id,
              note:"Production: "+d.item_name+" by "+sub.submitted_by,
              date:new Date().toISOString().slice(0,10),
              time:new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
            })
          }
        }
        if (item) {
          await supabase.from("ingredients").update({ stock:(item.stock||0)+d.batch_qty }).eq("id",item.id)
          await supabase.from("production_batches").insert({
            id:"PRD-"+Date.now(), item_id:d.item_id, item_name:d.item_name,
            batch_qty:d.batch_qty, unit:d.unit, date:new Date().toISOString().slice(0,10),
            produced_by:sub.submitted_by, notes:d.notes||null,
            ingredients_used:d.ingredients_used, status:"Completed"
          })
        }
      }
      await supabase.from("staff_submissions").update({ status:"approved", reviewed_at:new Date().toISOString() }).eq("id",sub.id)
      await load(); setViewModal(null)
    } catch(e) { alert("Error: "+e.message) }
    setProcessing(false)
  }

  async function reject(sub) {
    if (!confirm("Reject this submission?")) return
    await supabase.from("staff_submissions").update({ status:"rejected", reviewed_at:new Date().toISOString() }).eq("id",sub.id)
    await load(); setViewModal(null)
  }

  async function convertToPO(sub) {
    const items = (sub.data.items||[]).map(item => ({
      ingredient_id:item.ingredient_id, name:item.ingredient_name,
      qty:item.qty, unit:item.unit, unit_cost:0, total_cost:0, notes:item.notes,
    }))
    const poId = "PO-"+Date.now()
    await supabase.from("purchase_orders").insert({
      id:poId, supplierId:"", supplierName:"— Select Supplier —",
      invoiceNo:poId, date:new Date().toISOString().slice(0,10),
      status:"Unpaid", subtotal:0, total:0, items,
      notes:"From staff requisition by "+sub.submitted_by+". Please assign supplier and prices."
    })
    await supabase.from("staff_submissions").update({ status:"approved", reviewed_at:new Date().toISOString() }).eq("id",sub.id)
    await load()
    alert("Draft PO created. Go to Purchase Orders to complete it.")
  }

  function sendReqToSupplierWA(sub) {
    const items = sub.data?.items || []
    const bySupplier = {}
    items.forEach(item => {
      const sup = item.supplier || "Supplier Tidak Diketahui"
      if (!bySupplier[sup]) bySupplier[sup] = []
      bySupplier[sup].push(item)
    })
    if (Object.keys(bySupplier).length === 0) { alert("No items"); return }
    const date = new Date(sub.submitted_at).toLocaleDateString("id-ID")
    let text = "*PERMINTAAN BAHAN - PawonLoka*\n"
    text += "Tanggal: " + date + "\n"
    text += "Station: " + (sub.data?.station || "-") + "\n"
    text += "Dibutuhkan: " + (sub.data?.needed_by || "Hari ini") + "\n\n"
    Object.entries(bySupplier).forEach(([sup, its]) => {
      text += "*" + sup + "*\n"
      its.forEach(i => { text += "- " + i.ingredient_name + " " + i.qty + " " + i.unit + "\n" })
      text += "\n"
    })
    if (sub.data?.notes) text += "Catatan: " + sub.data.notes + "\n"
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank")
  }

    const staffUrl = window.location.origin + "/staff"

  return (
    <div>
      {/* Notification banner */}
      {newCount > 0 && (
        <div style={{ padding:"12px 16px", background:"var(--amber-lt)", border:"1.5px solid var(--amber)", borderRadius:"var(--r)", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:700, color:"var(--amber)", fontSize:13 }}>
            {newCount} new report{newCount>1?"s":""} received
          </div>
          <button onClick={load} className="bo-btn bo-btn-sm" style={{ background:"var(--amber)", color:"#fff", border:"none" }}>Refresh</button>
        </div>
      )}

      {/* Staff link */}
      <div style={{ marginBottom:16, padding:"12px 16px", background:"var(--brand-lt)", borderRadius:"var(--r)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--brand)" }}>Staff Mobile Link</div>
          <div style={{ fontSize:12, color:"var(--ink4)", marginTop:2 }}>Share this link with your staff</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <code style={{ fontSize:12, background:"#fff", padding:"5px 10px", borderRadius:8, border:"1px solid var(--surface3)" }}>{staffUrl}</code>
          <button onClick={()=>navigator.clipboard.writeText(staffUrl)} className="bo-btn bo-btn-ghost bo-btn-sm">Copy</button>
          <a href="/staff" target="_blank" className="bo-btn bo-btn-primary bo-btn-sm" style={{ textDecoration:"none" }}>Open</a>
        </div>
      </div>

      {/* Stats */}
      <div className="bo-metrics" style={{ gridTemplateColumns:"repeat(3,1fr)", marginBottom:16 }}>
        <div className="bo-met amber">
          <div className="bo-met-label">Pending</div>
          <div className="bo-met-val" style={{ display:"flex", alignItems:"center", gap:8 }}>
            {pending.length}
            {pending.length > 0 && <span style={{ fontSize:11, background:"var(--amber)", color:"#fff", borderRadius:20, padding:"1px 8px", fontWeight:700 }}>NEW</span>}
          </div>
        </div>
        <div className="bo-met green"><div className="bo-met-label">Approved</div><div className="bo-met-val">{approved.length}</div></div>
        <div className="bo-met red"><div className="bo-met-label">Rejected</div><div className="bo-met-val">{rejected.length}</div></div>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:4 }}>
          {[["all","All Types"],["opname","Stock Count"],["waste","Waste"],["production","Production"],["requisition","Request"]].map(([f,l])=>(
            <button key={f} onClick={()=>setTypeFilter(f)}
              className={"bo-btn bo-btn-sm "+(typeFilter===f?"bo-btn-primary":"bo-btn-ghost")}
              style={{ fontSize:11 }}>{TYPE_ICONS[f]||""} {l}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
          {[["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["all","All"]].map(([f,l])=>(
            <button key={f} onClick={()=>setStatusFilter(f)}
              className={"bo-btn bo-btn-sm "+(statusFilter===f?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bo-card" style={{ padding:0, overflowX:"auto" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
          <table className="bo-table">
            <thead><tr><th>Type</th><th>Staff</th><th>Station</th><th>Date</th><th>Summary</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(s => {
                const c = TYPE_COLORS[s.type]||"var(--ink5)"
                const summary = s.type==="opname" ? (s.data.items||[]).length+" items counted"
                  : s.type==="waste" ? s.data.qty+" "+s.data.unit+" — "+s.data.ingredient_name
                  : s.type==="requisition" ? (s.data.items||[]).length+" items requested"
                  : s.data.batch_qty+" "+(s.data.yield_unit||s.data.unit||"")+" "+s.data.item_name
                return (
                  <tr key={s.id} style={{ background: s.status==="pending"?"#fffbeb":"" }}>
                    <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:c+"22", color:c }}>{TYPE_ICONS[s.type]} {TYPE_LABELS[s.type]||s.type}</span></td>
                    <td style={{ fontWeight:600 }}>{s.submitted_by||"—"}</td>
                    <td style={{ fontSize:12, color:"var(--ink4)" }}>{s.data?.station||"—"}</td>
                    <td style={{ fontSize:12 }}>{new Date(s.submitted_at).toLocaleString("id-ID")}</td>
                    <td style={{ fontSize:12, color:"var(--ink4)" }}>{summary}</td>
                    <td><span className={"bo-badge "+(s.status==="pending"?"bo-badge-amber":s.status==="approved"?"bo-badge-green":"bo-badge-red")}>{s.status}</span></td>
                    <td>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>setViewModal(s)} className="bo-btn bo-btn-ghost bo-btn-sm">View</button>
                        <button onClick={()=>openEdit(s)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ color:"var(--brand)" }}>Edit</button>
                        {s.status==="pending" && <>
                          <button onClick={()=>approve(s)} disabled={processing} className="bo-btn bo-btn-sm" style={{ background:"var(--green-lt)", color:"var(--green)", border:"none", cursor:"pointer", borderRadius:"var(--r)", padding:"5px 11px", fontSize:12, fontWeight:600 }}>Approve</button>
                          <button onClick={()=>reject(s)} disabled={processing} className="bo-btn bo-btn-danger bo-btn-sm">Reject</button>
                        </>}
                        {s.type==="requisition" && s.status==="pending" && <button onClick={()=>convertToPO(s)} className="bo-btn bo-btn-sm" style={{ background:"#6554C0", color:"#fff", border:"none", cursor:"pointer", borderRadius:"var(--r)", padding:"5px 11px", fontSize:12, fontWeight:600 }}>To PO</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length===0 && <tr><td colSpan={7} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>No submissions found</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* View Modal */}
      {viewModal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setViewModal(null)}>
          <div className="bo-modal" style={{ maxWidth:560, maxHeight:"90vh" }}>
            <div className="bo-modal-header">
              <div>
                <div className="bo-modal-title">{TYPE_ICONS[viewModal.type]} {TYPE_LABELS[viewModal.type]} Report</div>
                <div style={{ fontSize:11, color:"var(--ink5)" }}>By {viewModal.submitted_by} · Station: {viewModal.data?.station||"—"} · {new Date(viewModal.submitted_at).toLocaleString("id-ID")}</div>
              </div>
              <button className="bo-modal-close" onClick={()=>setViewModal(null)}>x</button>
            </div>
            <div className="bo-modal-body" style={{ overflowY:"auto" }}>
              {viewModal.type==="opname" && (
                <table className="bo-table">
                  <thead><tr><th>Ingredient</th><th>System</th><th>Actual</th><th>Diff</th></tr></thead>
                  <tbody>
                    {(viewModal.data.items||[]).map((item,i)=>(
                      <tr key={i}>
                        <td style={{ fontWeight:600 }}>{item.name}</td>
                        <td>{item.system_qty} {item.unit}</td>
                        <td style={{ fontWeight:700 }}>{item.actual_qty} {item.unit}</td>
                        <td style={{ color:item.diff<0?"var(--red)":item.diff>0?"var(--green)":"var(--ink5)", fontWeight:700 }}>{item.diff>0?"+":""}{Number(item.diff).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {viewModal.type==="waste" && (
                <div style={{ display:"grid", gap:14 }}>
                  {[["Ingredient",viewModal.data.ingredient_name],["Quantity",viewModal.data.qty+" "+viewModal.data.unit],["Reason",viewModal.data.reason],["Est. Cost",fmt(viewModal.data.estimated_cost)],["Notes",viewModal.data.notes||"—"]].map(([k,v])=>(
                    <div key={k}><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>{k}</div><div style={{ fontWeight:600, marginTop:3 }}>{v}</div></div>
                  ))}
                </div>
              )}
              {viewModal.type==="requisition" && (
                <div>
                  <div style={{ marginBottom:12, fontSize:12, color:"var(--ink4)" }}>Needed by: <strong>{viewModal.data.needed_by||"—"}</strong> · Notes: {viewModal.data.notes||"—"}</div>
                  <table className="bo-table">
                    <thead><tr><th>Ingredient</th><th>Qty</th><th>Unit</th></tr></thead>
                    <tbody>
                      {(viewModal.data.items||[]).map((item,i)=>(
                        <tr key={i}>
                          <td style={{ fontWeight:600 }}>{item.ingredient_name}</td>
                          <td style={{ fontWeight:700, color:"#6554C0" }}>{item.qty}</td>
                          <td>{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {viewModal.type==="production" && (
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    <div><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>Produced</div><div style={{ fontWeight:700, color:"var(--green)", marginTop:3 }}>{viewModal.data.item_name}</div></div>
                    <div><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>Quantity</div><div style={{ fontWeight:700, marginTop:3 }}>{viewModal.data.batch_qty} {viewModal.data.yield_unit||viewModal.data.unit}</div></div>
                  </div>
                  <table className="bo-table">
                    <thead><tr><th>Ingredient</th><th>Qty</th><th>Unit</th></tr></thead>
                    <tbody>{(viewModal.data.ingredients_used||[]).map((u,i)=><tr key={i}><td>{u.name}</td><td>{u.qty}</td><td>{u.unit}</td></tr>)}</tbody>
                  </table>
                  {viewModal.data.notes && <div style={{ marginTop:12, fontSize:12, color:"var(--ink4)" }}>Notes: {viewModal.data.notes}</div>}
                </div>
              )}
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setViewModal(null)} className="bo-btn bo-btn-ghost">Close</button>
              <button onClick={()=>openEdit(viewModal)} className="bo-btn bo-btn-ghost" style={{ color:"var(--brand)" }}>Edit</button>
              {viewModal.type==="requisition" && <button onClick={()=>sendReqToSupplierWA(viewModal)} style={{background:"#25D366",color:"#fff",border:"none",borderRadius:"var(--r)",padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>WA Supplier</button>}
              {viewModal.status==="pending" && <>
                <button onClick={()=>reject(viewModal)} disabled={processing} className="bo-btn bo-btn-danger">Reject</button>
                {viewModal.type==="requisition"
                  ? <button onClick={()=>convertToPO(viewModal)} disabled={processing} className="bo-btn bo-btn-primary" style={{ background:"#6554C0" }}>Convert to PO</button>
                  : <button onClick={()=>approve(viewModal)} disabled={processing} className="bo-btn bo-btn-primary">Approve & Apply</button>
                }
              </>}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && editData && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setEditModal(null)}>
          <div className="bo-modal" style={{ maxWidth:580, maxHeight:"90vh" }}>
            <div className="bo-modal-header">
              <div>
                <div className="bo-modal-title">Edit — {TYPE_ICONS[editModal.type]} {TYPE_LABELS[editModal.type]}</div>
                <div style={{ fontSize:11, color:"var(--ink5)" }}>By {editModal.submitted_by} · {new Date(editModal.submitted_at).toLocaleString("id-ID")}</div>
              </div>
              <button className="bo-modal-close" onClick={()=>setEditModal(null)}>x</button>
            </div>
            <div className="bo-modal-body" style={{ overflowY:"auto" }}>
              {/* Notes field for all types */}
              <div className="bo-form-row">
                <label className="bo-label">Notes</label>
                <input value={editData.notes||""} onChange={e=>setEditData(d=>({...d,notes:e.target.value}))} className="bo-input" placeholder="Add notes..." />
              </div>

              {editModal.type==="opname" && (
                <div>
                  <label className="bo-label" style={{ marginBottom:8, display:"block" }}>Stock Counts</label>
                  {(editData.items||[]).map((item,i)=>(
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 100px 60px", gap:8, marginBottom:8, alignItems:"center" }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{item.name}</div>
                      <input type="number" value={item.actual_qty} onChange={e=>{
                        const val = parseFloat(e.target.value)||0
                        setEditData(d=>({ ...d, items:d.items.map((x,idx)=>idx===i?{...x,actual_qty:val,diff:val-x.system_qty}:x) }))
                      }} className="bo-input" style={{ fontSize:13 }} />
                      <span style={{ fontSize:12, color:"var(--ink4)" }}>{item.unit}</span>
                    </div>
                  ))}
                </div>
              )}

              {editModal.type==="waste" && (
                <div style={{ display:"grid", gap:12 }}>
                  <div><label className="bo-label">Quantity</label>
                    <input type="number" value={editData.qty||""} onChange={e=>setEditData(d=>({...d,qty:parseFloat(e.target.value)||0}))} className="bo-input" /></div>
                  <div><label className="bo-label">Reason</label>
                    <select value={editData.reason||"Expired"} onChange={e=>setEditData(d=>({...d,reason:e.target.value}))} className="bo-select">
                      {["Expired","Damaged","Overproduction","Spillage","Other"].map(r=><option key={r}>{r}</option>)}
                    </select></div>
                </div>
              )}

              {editModal.type==="requisition" && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <label className="bo-label" style={{marginBottom:0}}>Items Requested</label>
                    <button onClick={()=>setEditData(d=>({...d,items:[...(d.items||[]),{ingredient_id:"",ingredient_name:"",qty:0,unit:""}]}))}
                      className="bo-btn bo-btn-ghost bo-btn-sm">+ Add Item</button>
                  </div>
                  {(editData.items||[]).map((item,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 60px 28px",gap:8,marginBottom:8,alignItems:"center"}}>
                      {item.ingredient_id
                        ? <div style={{fontSize:13,fontWeight:600}}>{item.ingredient_name}</div>
                        : <IngSearchEdit ingredients={ingredients} onSelect={ing=>{
                            setEditData(d=>({...d,items:d.items.map((x,idx)=>idx===i?{...x,ingredient_id:ing.id,ingredient_name:ing.name,unit:ing.unit||""}:x)}))
                          }} />
                      }
                      <input type="number" value={item.qty} onChange={e=>{
                        setEditData(d=>({...d,items:d.items.map((x,idx)=>idx===i?{...x,qty:parseFloat(e.target.value)||0}:x)}))
                      }} className="bo-input" style={{fontSize:13}} />
                      <span style={{fontSize:12,color:"var(--ink4)"}}>{item.unit}</span>
                      <button onClick={()=>setEditData(d=>({...d,items:d.items.filter((_,idx)=>idx!==i)}))}
                        style={{background:"none",border:"none",color:"var(--red)",fontSize:18,cursor:"pointer",padding:0}}>x</button>
                    </div>
                  ))}
                </div>
              )}

              {editModal.type==="production" && (
                <div style={{ display:"grid", gap:12 }}>
                  <div>
                    <label className="bo-label" style={{ fontSize:13, fontWeight:800, color:"var(--ink1)" }}>Batch Quantity</label>
                    <input type="number" value={editData.batch_qty||""} onChange={e=>setEditData(d=>({...d,batch_qty:parseFloat(e.target.value)||0}))} className="bo-input" />
                  </div>
                  <div style={{ borderTop:"1px solid var(--surface3)", paddingTop:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <label className="bo-label" style={{ marginBottom:0, fontSize:13, fontWeight:800, color:"var(--ink1)" }}>Ingredients Used</label>
                      <button onClick={()=>setEditData(d=>({ ...d, ingredients_used:[...(d.ingredients_used||[]), { ingredient_id:"", name:"", qty:0, unit:"gr" }] }))}
                        className="bo-btn bo-btn-ghost bo-btn-sm" style={{ fontSize:12 }}>+ Add Ingredient</button>
                    </div>
                    {(editData.ingredients_used||[]).map((u,i)=>(
                      <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 80px 60px 28px", gap:8, marginBottom:8, alignItems:"center" }}>
                        {u.ingredient_id ? (
                          <div style={{ fontSize:13, fontWeight:600, padding:"8px 4px" }}>{u.name}</div>
                        ) : (
                          <IngSearchEdit ingredients={ingredients} onSelect={ing=>{
                            setEditData(d=>({ ...d, ingredients_used:d.ingredients_used.map((x,idx)=>idx===i?{...x,ingredient_id:ing.id,name:ing.name,unit:ing.unit||"gr"}:x) }))
                          }} />
                        )}
                        <input type="number" value={u.qty} onChange={e=>{
                          setEditData(d=>({ ...d, ingredients_used:d.ingredients_used.map((x,idx)=>idx===i?{...x,qty:parseFloat(e.target.value)||0}:x) }))
                        }} className="bo-input" style={{ fontSize:13 }} />
                        <span style={{ fontSize:12, color:"var(--ink4)" }}>{u.unit}</span>
                        <button onClick={()=>setEditData(d=>({ ...d, ingredients_used:d.ingredients_used.filter((_,idx)=>idx!==i) }))}
                          style={{ background:"none", border:"none", color:"var(--red)", fontSize:18, cursor:"pointer", padding:0 }}>x</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setEditModal(null)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={saveEdit} className="bo-btn bo-btn-primary">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
