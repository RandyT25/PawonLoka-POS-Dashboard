import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }
const TYPE_COLORS = { opname:"var(--brand)", waste:"var(--red)", production:"var(--green)", requisition:"#6554C0" }
const TYPE_ICONS  = { opname:"📋", waste:"🗑️", production:"🏭", requisition:"🛒" }

export default function StaffSubmissions() {
  const [submissions, setSubmissions] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [filter,      setFilter]      = useState("pending")
  const [viewModal,   setViewModal]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [processing,  setProcessing]  = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:s }, { data:i }] = await Promise.all([
      supabase.from("staff_submissions").select("*").order("submitted_at", { ascending:false }),
      supabase.from("ingredients").select("*"),
    ])
    setSubmissions(s||[]); setIngredients(i||[])
    setLoading(false)
  }

  const pending  = submissions.filter(s=>s.status==="pending")
  const approved = submissions.filter(s=>s.status==="approved")
  const rejected = submissions.filter(s=>s.status==="rejected")
  const filtered = filter==="pending"?pending:filter==="approved"?approved:rejected

  async function approve(sub) {
    if (!confirm(`Approve and apply this ${sub.type} report?`)) return
    setProcessing(true)
    try {
      if (sub.type==="opname") {
        for (const item of sub.data.items||[]) {
          await supabase.from("ingredients").update({ stock:item.actual_qty }).eq("id",item.ingredient_id)
          await supabase.from("stock_movements").insert({
            id:"MOV-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
            type:"Adjustment", ingredient_id:item.ingredient_id, ingredient_name:item.name,
            qty:item.diff, unit:item.unit, ref:sub.id,
            note:`Staff opname by ${sub.submitted_by}`,
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
            note:`Staff waste by ${sub.submitted_by}: ${d.reason}`,
            date:new Date().toISOString().slice(0,10),
            time:new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
          })
        }
      } else if (sub.type==="requisition") {
        // Requisition just gets marked approved — manager converts to PO manually
        // No stock changes
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
              note:`Production: ${d.item_name} by ${sub.submitted_by}`,
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
    // Build PO payload from requisition items grouped by supplier
    const items = (sub.data.items||[]).map(item => ({
      ingredient_id: item.ingredient_id,
      name: item.ingredient_name,
      qty: item.qty,
      unit: item.unit,
      unit_cost: 0,
      total_cost: 0,
      notes: item.notes,
    }))
    const poId = "PO-"+Date.now()
    await supabase.from("purchase_orders").insert({
      id: poId,
      supplierId: "", supplierName: "— Select Supplier —",
      invoiceNo: poId,
      date: new Date().toISOString().slice(0,10),
      status: "Unpaid", subtotal: 0, total: 0,
      items,
      notes: `From staff requisition by ${sub.submitted_by}. Please assign supplier and prices.`
    })
    await supabase.from("staff_submissions").update({ status:"approved", reviewed_at:new Date().toISOString() }).eq("id", sub.id)
    await load()
    alert(`✅ Draft PO created from requisition. Go to Purchase Orders to complete it.`)
  }

  const staffUrl = window.location.origin + "/staff"

  return (
    <div>
      <div style={{ marginBottom:16, padding:"12px 16px", background:"var(--brand-lt)", borderRadius:"var(--r)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--brand)" }}>📱 Staff Mobile Link</div>
          <div style={{ fontSize:12, color:"var(--ink4)", marginTop:2 }}>Share this link with your staff</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <code style={{ fontSize:12, background:"#fff", padding:"5px 10px", borderRadius:8, border:"1px solid var(--surface3)" }}>{staffUrl}</code>
          <button onClick={()=>navigator.clipboard.writeText(staffUrl)} className="bo-btn bo-btn-ghost bo-btn-sm">Copy</button>
          <a href="/staff" target="_blank" className="bo-btn bo-btn-primary bo-btn-sm" style={{ textDecoration:"none" }}>Open ↗</a>
        </div>
      </div>

      <div className="bo-metrics" style={{ gridTemplateColumns:"repeat(3,1fr)", marginBottom:16 }}>
        <div className="bo-met amber"><div className="bo-met-label">Pending Review</div><div className="bo-met-val">{pending.length}</div></div>
        <div className="bo-met green"><div className="bo-met-label">Approved</div><div className="bo-met-val">{approved.length}</div></div>
        <div className="bo-met red"><div className="bo-met-label">Rejected</div><div className="bo-met-val">{rejected.length}</div></div>
      </div>

      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {[["pending","Pending"],["approved","Approved"],["rejected","Rejected"]].map(([f,l])=>(
          <button key={f} onClick={()=>setFilter(f)} className={"bo-btn bo-btn-sm "+(filter===f?"bo-btn-primary":"bo-btn-ghost")}>{l} ({f==="pending"?pending.length:f==="approved"?approved.length:rejected.length})</button>
        ))}
      </div>

      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
          <table className="bo-table">
            <thead><tr><th>Type</th><th>Staff</th><th>Date</th><th>Summary</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(s=>{
                const c = TYPE_COLORS[s.type]||"var(--ink5)"
                const summary = s.type==="opname" ? `${(s.data.items||[]).length} items counted`
                  : s.type==="waste" ? `${s.data.qty} ${s.data.unit} — ${s.data.ingredient_name}`
                  : s.type==="requisition" ? `${(s.data.items||[]).length} items requested`
                  : `${s.data.batch_qty} ${s.data.unit} ${s.data.item_name}`
                return (
                  <tr key={s.id}>
                    <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:c+"22", color:c }}>{TYPE_ICONS[s.type]} {s.type}</span></td>
                    <td style={{ fontWeight:600 }}>{s.submitted_by||"—"}</td>
                    <td style={{ fontSize:12 }}>{new Date(s.submitted_at).toLocaleString("id-ID")}</td>
                    <td style={{ fontSize:12, color:"var(--ink4)" }}>{summary}</td>
                    <td><span className={"bo-badge "+(s.status==="pending"?"bo-badge-amber":s.status==="approved"?"bo-badge-green":"bo-badge-red")}>{s.status}</span></td>
                    <td>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>setViewModal(s)} className="bo-btn bo-btn-ghost bo-btn-sm">View</button>
                        {s.status==="pending" && <>
                          <button onClick={()=>approve(s)} disabled={processing} className="bo-btn bo-btn-sm" style={{ background:"var(--green-lt)", color:"var(--green)", border:"none", cursor:"pointer", borderRadius:"var(--r)", padding:"5px 11px", fontSize:12, fontWeight:600 }}>✓ Approve</button>
                          <button onClick={()=>reject(s)} disabled={processing} className="bo-btn bo-btn-danger bo-btn-sm">Reject</button>
                        </>}
                        {s.type==="requisition" && s.status==="pending" && <button onClick={()=>convertToPO(s)} className="bo-btn bo-btn-sm" style={{ background:"#6554C0", color:"#fff", border:"none", cursor:"pointer", borderRadius:"var(--r)", padding:"5px 11px", fontSize:12, fontWeight:600 }}>→ To PO</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length===0 && <tr><td colSpan={6} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>No {filter} submissions</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {viewModal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setViewModal(null)}>
          <div className="bo-modal" style={{ maxWidth:560, maxHeight:"90vh" }}>
            <div className="bo-modal-header">
              <div>
                <div className="bo-modal-title">{TYPE_ICONS[viewModal.type]} {viewModal.type.charAt(0).toUpperCase()+viewModal.type.slice(1)} Report</div>
                <div style={{ fontSize:11, color:"var(--ink5)" }}>By {viewModal.submitted_by} · {new Date(viewModal.submitted_at).toLocaleString("id-ID")}</div>
              </div>
              <button className="bo-modal-close" onClick={()=>setViewModal(null)}>✕</button>
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
                  {[["Ingredient",viewModal.data.ingredient_name],["Quantity",`${viewModal.data.qty} ${viewModal.data.unit}`],["Reason",viewModal.data.reason],["Est. Cost",fmt(viewModal.data.estimated_cost)],["Notes",viewModal.data.notes||"—"]].map(([k,v])=>(
                    <div key={k}><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>{k}</div><div style={{ fontWeight:600, marginTop:3 }}>{v}</div></div>
                  ))}
                </div>
              )}
              {viewModal.type==="requisition" && (
                <table className="bo-table">
                  <thead><tr><th>Ingredient</th><th>Qty Needed</th><th>Unit</th><th>Needed By</th><th>Notes</th></tr></thead>
                  <tbody>
                    {(viewModal.data.items||[]).map((item,i)=>(
                      <tr key={i}>
                        <td style={{ fontWeight:600 }}>{item.ingredient_name}</td>
                        <td style={{ fontWeight:700, color:"#6554C0" }}>{item.qty}</td>
                        <td>{item.unit}</td>
                        <td style={{ fontSize:12 }}>{item.needed_by||"—"}</td>
                        <td style={{ fontSize:12, color:"var(--ink4)" }}>{item.notes||"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {viewModal.type==="production" && (
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    <div><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>Produced Item</div><div style={{ fontWeight:700, color:"var(--green)", marginTop:3 }}>{viewModal.data.item_name}</div></div>
                    <div><div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase" }}>Quantity</div><div style={{ fontWeight:700, marginTop:3 }}>{viewModal.data.batch_qty} {viewModal.data.unit}</div></div>
                  </div>
                  <table className="bo-table">
                    <thead><tr><th>Ingredient</th><th>Qty</th><th>Unit</th></tr></thead>
                    <tbody>{(viewModal.data.ingredients_used||[]).map((u,i)=><tr key={i}><td>{u.name}</td><td>{u.qty}</td><td>{u.unit}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setViewModal(null)} className="bo-btn bo-btn-ghost">Close</button>
              {viewModal.status==="pending" && <>
                <button onClick={()=>reject(viewModal)} disabled={processing} className="bo-btn bo-btn-danger">Reject</button>
                {viewModal.type==="requisition"
                  ? <button onClick={()=>convertToPO(viewModal)} disabled={processing} className="bo-btn bo-btn-primary" style={{ background:"#6554C0" }}>→ Convert to PO</button>
                  : <button onClick={()=>approve(viewModal)} disabled={processing} className="bo-btn bo-btn-primary">✓ Approve & Apply</button>
                }
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
