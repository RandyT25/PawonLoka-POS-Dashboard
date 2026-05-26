import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const fmt = n => "Rp " + Math.round(n||0).toLocaleString("id-ID")

function sendWA(order) {
  const phone = order.customer_phone || prompt('Enter customer WhatsApp number (e.g. 628123456789):')
  if (!phone) return
  const clean = phone.replace(/\D/g,'').replace(/^0/,'62')
  const total = 'Rp ' + Math.round(order.total||0).toLocaleString('id-ID')
  const text = 'Halo ' + (order.customer||'Kak') + '!\n\nTerima kasih sudah makan di PawonLoka!\n\n*Struk Digital*\nNo. Order : ' + order.id + '\nMeja      : ' + (order.table||'Walk-in') + '\nTotal     : ' + total + '\n\nLihat struk lengkap:\nhttps://pawonloka.pages.dev/receipt?id=' + order.id + '\n\nSampai jumpa lagi!'
  window.open('https://wa.me/' + clean + '?text=' + encodeURIComponent(text), '_blank')
}

const STATUS_COLORS = {
  paid: { bg:"#DCFCE7", color:"#16A34A" },
  open: { bg:"#FEF9C3", color:"#CA8A04" },
  void: { bg:"#FEE2E2", color:"#DC2626" },
  cancelled: { bg:"#FEE2E2", color:"#DC2626" },
}

export default function Orders() {
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter]     = useState(() => new Date().toISOString().slice(0,10))
  const [selected, setSelected] = useState(null)

  useEffect(() => { load() }, [dateFilter])

  async function load() {
    setLoading(true)
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false })
    if (dateFilter) q = q.gte("created_at", dateFilter + "T00:00:00+08:00").lte("created_at", dateFilter + "T23:59:59+08:00")
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter
    const matchSearch = !search || o.id?.toLowerCase().includes(search.toLowerCase()) ||
      o.staff?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.toLowerCase().includes(search.toLowerCase()) ||
      o.table?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const totalRevenue = filtered.filter(o=>o.status==="paid").reduce((s,o)=>s+(o.total||0),0)
  const totalOrders  = filtered.filter(o=>o.status==="paid").length

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:900, color:"var(--ink1)", marginBottom:4 }}>Orders History</div>
        <div style={{ fontSize:13, color:"var(--ink4)" }}>All transactions and order details</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {[
          ["Total Orders", totalOrders, "#0052CC"],
          ["Revenue", fmt(totalRevenue), "#16A34A"],
          ["Avg Order", fmt(totalOrders ? totalRevenue/totalOrders : 0), "#7C3AED"],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:"#fff", borderRadius:12, padding:"16px 20px", border:"1px solid #E8ECF0" }}>
            <div style={{ fontSize:12, color:"var(--ink4)", fontWeight:600, marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:900, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
          className="bo-input" style={{ width:160 }} />
        <input placeholder="Search order, staff, customer..." value={search}
          onChange={e=>setSearch(e.target.value)} className="bo-input" style={{ flex:1, minWidth:200 }} />
        <div style={{ display:"flex", gap:6 }}>
          {["all","paid","open","void"].map(s => (
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={"bo-btn " + (statusFilter===s?"bo-btn-primary":"bo-btn-ghost")}
              style={{ textTransform:"capitalize", padding:"6px 14px" }}>{s}</button>
          ))}
        </div>
        <button onClick={load} className="bo-btn bo-btn-ghost">Refresh</button>
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["Order ID","Time","Table","Staff","Customer","Items","Total","Status"].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--ink4)", borderBottom:"1px solid #E8ECF0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign:"center", padding:40, color:"var(--ink4)" }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:"center", padding:40, color:"var(--ink4)" }}>No orders found</td></tr>
            ) : filtered.map(o => {
              const sc = STATUS_COLORS[o.status] || STATUS_COLORS.open
              const time = o.created_at ? new Date(o.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}) : "-"
              return (
                <tr key={o.id} onClick={()=>setSelected(o)}
                  style={{ cursor:"pointer", borderBottom:"1px solid #F0F4F8" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{ padding:"10px 14px", fontSize:12, fontWeight:700, color:"#0052CC" }}>{o.id?.slice(-8)}</td>
                  <td style={{ padding:"10px 14px", fontSize:12 }}>{time}</td>
                  <td style={{ padding:"10px 14px", fontSize:12 }}>{o.table||o.order_type||"-"}</td>
                  <td style={{ padding:"10px 14px", fontSize:12 }}>{o.staff||"-"}</td>
                  <td style={{ padding:"10px 14px", fontSize:12 }}>{o.customer||"-"}</td>
                  <td style={{ padding:"10px 14px", fontSize:12 }}>{(o.items||[]).length} items</td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700 }}>{fmt(o.total)}</td>
                  <td style={{ padding:"10px 14px" }}>
                    <span style={{ ...sc, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>{o.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Order Detail Modal */}
      {selected && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div className="bo-modal" style={{ maxWidth:520 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">Order {selected.id?.slice(-8)}</div>
              <button className="bo-modal-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
                {[
                  ["Staff", selected.staff||"-"],
                  ["Table", selected.table||selected.order_type||"-"],
                  ["Customer", selected.customer||"-"],
                  ["Payment", selected.payment_method||"-"],
                  ["Date", selected.created_at?.slice(0,10)||"-"],
                  ["Status", selected.status||"-"],
                ].map(([k,v])=>(
                  <div key={k} style={{ fontSize:12 }}>
                    <span style={{ color:"var(--ink4)", fontWeight:600 }}>{k}: </span>
                    <span style={{ fontWeight:700 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop:"1px solid #E8ECF0", paddingTop:12, marginBottom:12 }}>
                {(selected.items||[]).map((item,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #F8FAFC", fontSize:13 }}>
                    <div>
                      <span style={{ fontWeight:600 }}>{item.qty}x {item.name}</span>
                      {item.isBundle && item.bundleItems && (
                        <div style={{ fontSize:11, color:"var(--ink4)" }}>{item.bundleItems.map(b=>b.name).join(", ")}</div>
                      )}
                      {item.modifiers && Object.values(item.modifiers).length > 0 && (
                        <div style={{ fontSize:11, color:"#6366F1" }}>{Object.values(item.modifiers).join(", ")}</div>
                      )}
                      {item.note && <div style={{ fontSize:11, color:"var(--ink4)", fontStyle:"italic" }}>{item.note}</div>}
                    </div>
                    <span style={{ fontWeight:700 }}>{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                  <span style={{ color:"var(--ink4)" }}>Subtotal</span>
                  <span>{fmt(selected.subtotal)}</span>
                </div>
                {selected.discount > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#16A34A" }}>
                    <span>Discount</span><span>-{fmt(selected.discount)}</span>
                  </div>
                )}
                {selected.tax > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:"var(--ink4)" }}>Tax</span><span>{fmt(selected.tax)}</span>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:900, borderTop:"1px solid #E8ECF0", paddingTop:8, marginTop:4 }}>
                  <span>Total</span><span style={{ color:"#0052CC" }}>{fmt(selected.total)}</span>
                </div>
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setSelected(null)} className="bo-btn bo-btn-ghost">Close</button>
              {selected.status === "paid" && (
                <button onClick={()=>sendWA(selected)} className="bo-btn bo-btn-primary">
                  WhatsApp Receipt
                </button>
              )}
              {selected.status === "paid" && (
                <button onClick={async()=>{
                  if (!confirm("Void this order?")) return
                  await supabase.from("orders").update({ status:"void" }).eq("id", selected.id)
                  await load(); setSelected(null)
                }} className="bo-btn bo-btn-danger">Void Order</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
