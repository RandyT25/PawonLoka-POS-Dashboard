import { useState, useEffect } from "react"
import { supabase } from "../../../lib/supabase"
import { isFoodCategory } from "../../lib/ingredientCategories"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("en-US") }

export default function InvOverview({ onNav }) {
  const [ingredients, setIngredients] = useState([])
  const [pos,         setPOs]         = useState([])
  const [production,  setProduction]  = useState([])
  const [waste,       setWaste]       = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:ings }, { data:p }, { data:prod }, { data:wst }] = await Promise.all([
      supabase.from("ingredients").select("*"),
      supabase.from("purchase_orders").select("*").order("created_at", { ascending:false }),
      supabase.from("production_batches").select("*").order("created_at", { ascending:false }),
      supabase.from("waste_records").select("*").order("created_at", { ascending:false }),
    ])
    setIngredients((ings||[]).filter(i => isFoodCategory(i.category)))
    const posNorm=(p||[]).map(po=>({
      ...po,
      supplier_name: po.supplierName||po.supplier_name||"",
      invoice_no:    po.invoiceNo   ||po.invoice_no   ||"",
      order_date:    po.date        ||po.order_date    ||"",
      po_items:      po.items       ||po.po_items      ||[],
    }))
    setPOs(posNorm)
    setProduction(prod||[])
    setWaste(wst||[])
    setLoading(false)
  }

  const lowStock   = ingredients.filter(i => i.min_stock > 0 && i.stock <= i.min_stock && i.stock > 0)
  const outStock   = ingredients.filter(i => i.stock <= 0)
  const totalVal   = ingredients.reduce((a,i) => a + (i.stock||0)*(i.cost_per_unit||0), 0)
  const unpaidPOs  = pos.filter(p => p.status === "Unpaid")
  const unpaidTot  = unpaidPOs.reduce((a,p) => a+(p.total||0), 0)
  const overduePOs = pos.filter(p => p.status==="Unpaid" && p.due_date && new Date(p.due_date) < new Date())

  function MetCard({ ico, label, val, sub, color }) {
    return (
      <div style={{ background:"#fff", border:"1.5px solid var(--surface3)", borderRadius:16, padding:"16px 18px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:color||"var(--brand)" }} />
        <div style={{ fontSize:24, marginBottom:6 }}>{ico}</div>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--ink4)", textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:900, color:"var(--ink)", letterSpacing:"-0.5px", margin:"4px 0" }}>{val}</div>
        <div style={{ fontSize:11, color:"var(--ink5)" }}>{sub}</div>
      </div>
    )
  }

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>

  return (
    <div>
      <div className="inv-overview-kpi">
        <MetCard ico="📦" label="Ingredients"  val={ingredients.length}  sub="items tracked"             color="var(--brand)" />
        <MetCard ico="💰" label="Stock Value"   val={fmt(totalVal)}       sub="current inventory"         color="var(--green)" />
        <MetCard ico="⚠️" label="Low Stock"     val={lowStock.length}     sub="need reorder"              color={lowStock.length>0?"var(--amber)":"var(--green)"} />
        <MetCard ico="🚫" label="Out of Stock"  val={outStock.length}     sub="items"                     color={outStock.length>0?"var(--red)":"var(--green)"} />
        <MetCard ico="📋" label="Unpaid POs"    val={fmt(unpaidTot)}      sub={unpaidPOs.length+" invoices"} color="var(--amber)" />
        <MetCard ico="🔴" label="Overdue POs"   val={overduePOs.length}   sub="past due date"             color={overduePOs.length>0?"var(--red)":"var(--green)"} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:12, marginBottom:12 }}>
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title" style={{ display:"flex", justifyContent:"space-between" }}>
            ⚠️ Low Stock Alerts
            <button onClick={()=>onNav("inv-ingredients")} style={{ fontSize:11, color:"var(--brand)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>View All →</button>
          </div>
          {lowStock.length===0 && outStock.length===0
            ? <div style={{ fontSize:13, color:"var(--green)", fontWeight:600, padding:"12px 0" }}>✓ All stock levels healthy</div>
            : [...outStock,...lowStock].slice(0,8).map(i => {
                const pct = i.min_stock>0 ? Math.min(100,Math.round(i.stock/(i.min_stock||1)*100)) : 0
                return (
                  <div key={i.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--surface2)" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{i.name}</div>
                      <div style={{ height:4, background:"var(--surface2)", borderRadius:2, marginTop:4, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:pct+"%", background:i.stock<=0?"var(--red)":"var(--amber)", borderRadius:2 }} />
                      </div>
                    </div>
                    <div style={{ marginLeft:12, textAlign:"right", flexShrink:0 }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:i.stock<=0?"var(--red-lt)":"var(--amber-lt)", color:i.stock<=0?"var(--red)":"var(--amber)" }}>
                        {i.stock} {i.unit}
                      </span>
                      <div style={{ fontSize:10, color:"var(--ink5)", marginTop:2, fontWeight:600 }}>
                        Reorder: {Math.max(0,(i.min_stock||0)-(i.stock||0))} {i.unit}
                      </div>
                    </div>
                  </div>
                )
              })
          }
        </div>

        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title" style={{ display:"flex", justifyContent:"space-between" }}>
            📋 Recent Purchase Orders
            <button onClick={()=>onNav("inv-po")} style={{ fontSize:11, color:"var(--brand)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>View All →</button>
          </div>
          {pos.slice(0,5).map(po => {
            const isOverdue = po.status==="Unpaid" && po.due_date && new Date(po.due_date)<new Date()
            const c = po.status==="Paid" ? "var(--green)" : isOverdue ? "var(--red)" : "var(--amber)"
            return (
              <div key={po.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--surface2)" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>{po.invoice_no||po.id} · {po.supplier_name}</div>
                  <div style={{ fontSize:11, color:"var(--ink5)" }}>{po.order_date}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--brand)" }}>{fmt(po.total)}</div>
                  <span style={{ fontSize:10, fontWeight:700, color:c }}>{isOverdue?"Overdue":po.status}</span>
                </div>
              </div>
            )
          })}
          {pos.length===0 && <div style={{ fontSize:13, color:"var(--ink5)", padding:"12px 0" }}>No purchase orders yet</div>}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:12 }}>
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title" style={{ display:"flex", justifyContent:"space-between" }}>
            🏭 Recent Production
            <button onClick={()=>onNav("inv-production")} style={{ fontSize:11, color:"var(--brand)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>View All →</button>
          </div>
          {production.slice(0,4).map(p => (
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--surface2)" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>{p.item_name}</div>
                <div style={{ fontSize:11, color:"var(--ink5)" }}>{p.date} · {p.produced_by}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--green)" }}>{p.batch_qty} {p.unit}</div>
              </div>
            </div>
          ))}
          {production.length===0 && <div style={{ fontSize:13, color:"var(--ink5)", padding:"12px 0" }}>No production batches yet</div>}
        </div>

        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title" style={{ display:"flex", justifyContent:"space-between" }}>
            🗑️ Recent Waste
            <button onClick={()=>onNav("inv-waste")} style={{ fontSize:11, color:"var(--brand)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>View All →</button>
          </div>
          {waste.slice(0,4).map(w => (
            <div key={w.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--surface2)" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>{w.ingredient_name}</div>
                <div style={{ fontSize:11, color:"var(--ink5)" }}>{w.date} · {w.reason}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--red)" }}>{w.qty} {w.unit}</div>
                <div style={{ fontSize:11, color:"var(--red)" }}>−{fmt(w.cost||0)}</div>
              </div>
            </div>
          ))}
          {waste.length===0 && <div style={{ fontSize:13, color:"var(--ink5)", padding:"12px 0" }}>No waste records yet</div>}
        </div>
      </div>
    </div>
  )
}
