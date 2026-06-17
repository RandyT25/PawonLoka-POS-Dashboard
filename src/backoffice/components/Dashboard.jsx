import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n || 0).toLocaleString("id-ID") }

function statusBadge(status) {
  if (!status || status === "Paid" || status === "paid")     return { label:"Lunas",    bg:"#D1FAE5", color:"#065F46" }
  if (status === "Open"  || status === "open")               return { label:"Open Bill", bg:"#FEF3C7", color:"#92400E" }
  if (status === "Voided"|| status === "voided")             return { label:"Void",      bg:"#F1F5F9", color:"#64748B" }
  if (status === "Refunded"||status === "refunded")          return { label:"Refund",    bg:"#EDE9FE", color:"#5B21B6" }
  return { label: status, bg:"#F1F5F9", color:"#64748B" }
}

function OrderDetailModal({ order, onClose }) {
  if (!order) return null
  const items = order.items_snapshot || order.order_items || order.items || []
  const parsed = typeof items === "string" ? JSON.parse(items) : items
  const isPaid = !order.status || order.status === "Paid" || order.status === "paid"
  const badge  = statusBadge(order.status)
  const timeStr = new Date(order.created_at).toLocaleString("id-ID", { weekday:"short", day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:480,maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--surface3)",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:800,fontSize:16 }}>{order.code||"#"+String(order.id).slice(-6)}</div>
            <div style={{ fontSize:12,color:"var(--ink4)",marginTop:2 }}>{timeStr} · {order.table_name||order.table||"Walk-in"} · {order.staff||"—"}</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:10,background:badge.bg,color:badge.color }}>{badge.label}</span>
            <button onClick={onClose} style={{ background:"none",border:"none",fontSize:20,cursor:"pointer",color:"var(--ink4)" }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY:"auto",padding:"16px 20px",flex:1 }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
            <thead><tr style={{ borderBottom:"1px solid var(--surface3)" }}>
              <th style={{ textAlign:"left",padding:"4px 0",color:"var(--ink4)",fontWeight:600,fontSize:11 }}>Item</th>
              <th style={{ textAlign:"center",padding:"4px 8px",color:"var(--ink4)",fontWeight:600,fontSize:11 }}>Qty</th>
              <th style={{ textAlign:"right",padding:"4px 0",color:"var(--ink4)",fontWeight:600,fontSize:11 }}>Harga</th>
              <th style={{ textAlign:"right",padding:"4px 0",color:"var(--ink4)",fontWeight:600,fontSize:11 }}>Subtotal</th>
            </tr></thead>
            <tbody>
              {(parsed||[]).map((i,idx)=>(
                <tr key={idx} style={{ borderBottom:"1px solid var(--surface2)" }}>
                  <td style={{ padding:"7px 0" }}>
                    <div style={{ fontWeight:600 }}>{i.name}</div>
                    {i.modifiers&&Object.values(i.modifiers).length>0&&<div style={{ fontSize:11,color:"var(--ink4)" }}>{Object.values(i.modifiers).join(", ")}</div>}
                    {i.note&&<div style={{ fontSize:11,color:"var(--ink4)",fontStyle:"italic" }}>* {i.note}</div>}
                  </td>
                  <td style={{ textAlign:"center",padding:"7px 8px",color:"var(--ink3)" }}>{i.qty||1}</td>
                  <td style={{ textAlign:"right",padding:"7px 0",color:"var(--ink3)" }}>{fmt(i.price||0)}</td>
                  <td style={{ textAlign:"right",padding:"7px 0",fontWeight:600 }}>{fmt((i.price||0)*(i.qty||1))}</td>
                </tr>
              ))}
              {(!parsed||!parsed.length)&&<tr><td colSpan={4} style={{ textAlign:"center",color:"var(--ink5)",padding:"12px 0" }}>No items</td></tr>}
            </tbody>
          </table>
          <div style={{ marginTop:12,borderTop:"2px solid var(--surface3)",paddingTop:10 }}>
            {order.discount>0&&<div style={{ display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--red)",marginBottom:4 }}><span>Diskon</span><span>-{fmt(order.discount)}</span></div>}
            {order.tax>0&&<div style={{ display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--ink3)",marginBottom:4 }}><span>Pajak</span><span>{fmt(order.tax)}</span></div>}
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:800 }}><span>Total</span><span>{fmt(order.total)}</span></div>
            {isPaid&&<div style={{ display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--ink4)",marginTop:4 }}><span>Pembayaran</span><span className={"bo-badge bo-badge-green"}>{order.pay||"—"}</span></div>}
            {order.change>0&&<div style={{ display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--ink4)",marginTop:4 }}><span>Kembalian</span><span>{fmt(order.change)}</span></div>}
          </div>
        </div>
      </div>
    </div>
  )
}

const DUMMY_ORDERS = (() => {
  const today = new Date().toISOString().slice(0, 10)
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  return [
    { id:"d1",  code:"#1001", created_at:`${today}T08:14:00`, total:57750,  pay:"Cash",  staff:"Budi", table_name:"Table 2",  customer_id:"c1", cogs:14000, items_snapshot:[{name:"Nasi Goreng Telur",qty:2,price:20000},{name:"Teh Manis",qty:2,price:8000}] },
    { id:"d2",  code:"#1002", created_at:`${today}T08:38:00`, total:59290,  pay:"QRIS",  staff:"Budi", table_name:"Walk-in",  customer_id:"c2", cogs:15000, items_snapshot:[{name:"Ayam Bakar",qty:1,price:28000},{name:"Americano",qty:1,price:25000}] },
    { id:"d3",  code:"#1003", created_at:`${today}T09:05:00`, total:57750,  pay:"GoPay", staff:"Raka", table_name:"Table 4",  customer_id:"c3", cogs:12000, items_snapshot:[{name:"Matcha Latte",qty:2,price:25000}] },
    { id:"d4",  code:"#1004", created_at:`${today}T09:44:00`, total:57750,  pay:"Card",  staff:"Budi", table_name:"Table 1",  customer_id:null,  cogs:16000, items_snapshot:[{name:"Sate Kambing",qty:1,price:38000},{name:"Es Jeruk",qty:1,price:12000}] },
    { id:"d5",  code:"#1005", created_at:`${today}T10:20:00`, total:28875,  pay:"Cash",  staff:"Raka", table_name:"Walk-in",  customer_id:"c4", cogs:7000,  items_snapshot:[{name:"Bakmi Goreng",qty:1,price:25000}] },
    { id:"d6",  code:"#1006", created_at:`${today}T10:45:00`, total:57750,  pay:"Cash",  staff:"Budi", table_name:"Table 3",  customer_id:null,  cogs:13000, items_snapshot:[{name:"Latte",qty:2,price:25000}] },
    { id:"d7",  code:"#1007", created_at:`${today}T11:10:00`, total:49588,  pay:"QRIS",  staff:"Raka", table_name:"Table 5",  customer_id:"c2", cogs:11000, items_snapshot:[{name:"Nasi Goreng Spesial",qty:1,price:25000},{name:"Jus Alpukat",qty:1,price:18000}] },
    { id:"d8",  code:"#1008", created_at:`${today}T11:35:00`, total:50820,  pay:"OVO",   staff:"Budi", table_name:"Table 2",  customer_id:null,  cogs:9000,  items_snapshot:[{name:"Gado Gado",qty:2,price:22000}] },
    { id:"d9",  code:"#1009", created_at:`${today}T12:05:00`, total:96712,  pay:"Card",  staff:"Raka", table_name:"VIP Room", customer_id:"c5", cogs:21000, items_snapshot:[{name:"Cappuccino",qty:3,price:28000}] },
    { id:"d10", code:"#1010", created_at:`${today}T12:30:00`, total:73140,  pay:"Cash",  staff:"Budi", table_name:"Table 1",  customer_id:null,  cogs:15000, items_snapshot:[{name:"Soto Ayam",qty:2,price:20000},{name:"Teh Tarik",qty:2,price:12000}] },
    { id:"d11", code:"#1011", created_at:`${today}T13:00:00`, total:25300,  pay:"GoPay", staff:"Raka", table_name:"Walk-in",  customer_id:"c3", cogs:8000,  items_snapshot:[{name:"Bakso Malang",qty:1,price:22000}] },
    { id:"d12", code:"#1012", created_at:`${today}T13:25:00`, total:67650,  pay:"Cash",  staff:"Budi", table_name:"Table 3",  customer_id:null,  cogs:14000, items_snapshot:[{name:"Es Kopi Susu",qty:2,price:22000},{name:"Mendoan",qty:1,price:15000}] },
    { id:"d13", code:"#1013", created_at:`${today}T14:00:00`, total:41400,  pay:"QRIS",  staff:"Raka", table_name:"Outdoor 1",customer_id:null,  cogs:7500,  items_snapshot:[{name:"Pisang Goreng",qty:3,price:12000}] },
    { id:"d14", code:"#1014", created_at:`${today}T14:30:00`, total:80500,  pay:"Card",  staff:"Budi", table_name:"Table 4",  customer_id:"c4", cogs:22000, items_snapshot:[{name:"Nasi Goreng Seafood",qty:2,price:35000}] },
    { id:"d15", code:"#1015", created_at:`${today}T15:10:00`, total:49588,  pay:"OVO",   staff:"Raka", table_name:"Walk-in",  customer_id:null,  cogs:12000, items_snapshot:[{name:"Latte",qty:1,price:25000},{name:"Croissant",qty:1,price:18000}] },
    { id:"y1",  code:"#0901", created_at:`${yest}T09:00:00`,  total:23000,  pay:"Cash",  staff:"Budi", table_name:"Table 1",  customer_id:null,  cogs:5500,  items_snapshot:[{name:"Nasi Goreng Telur",qty:1,price:20000}] },
    { id:"y2",  code:"#0902", created_at:`${yest}T10:00:00`,  total:57750,  pay:"QRIS",  staff:"Raka", table_name:"Table 2",  customer_id:"c2", cogs:13800, items_snapshot:[{name:"Latte",qty:2,price:25000}] },
    { id:"y3",  code:"#0903", created_at:`${yest}T12:00:00`,  total:32200,  pay:"GoPay", staff:"Budi", table_name:"Walk-in",  customer_id:null,  cogs:9200,  items_snapshot:[{name:"Ayam Bakar",qty:1,price:28000}] },
    { id:"y4",  code:"#0904", created_at:`${yest}T14:00:00`,  total:75900,  pay:"Cash",  staff:"Raka", table_name:"Table 5",  customer_id:"c5", cogs:19800, items_snapshot:[{name:"Es Kopi Susu",qty:3,price:22000}] },
    { id:"y5",  code:"#0905", created_at:`${yest}T15:30:00`,  total:57750,  pay:"Card",  staff:"Budi", table_name:"Table 3",  customer_id:null,  cogs:14400, items_snapshot:[{name:"Bakmi Goreng",qty:2,price:25000}] },
  ]
})()

const PAY_COLORS = { Cash:"var(--green)", QRIS:"var(--brand)", Card:"#1565C0", GoPay:"#00ADE0", OVO:"#4527A0", Other:"var(--ink4)" }

export default function Dashboard() {
  const [range,    setRange]    = useState("today")
  const [loading,  setLoading]  = useState(true)
  const [useDummy, setUseDummy] = useState(false)
  const [stats,    setStats]    = useState({ sales:0, orders:0, customers:0, avgOrder:0, grossProfit:0, prevSales:0 })
  const [payments,       setPayments]       = useState([])
  const [topItems,       setTopItems]       = useState([])
  const [hourData,       setHourData]       = useState([])
  const [recent,         setRecent]         = useState([])
  const [selectedOrder,  setSelectedOrder]  = useState(null)

  useEffect(() => { load() }, [range, useDummy])

  useEffect(() => {
    const channel = supabase.channel("dashboard_realtime")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"orders" }, () => load())
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"orders" }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [range, useDummy])

  async function load() {
    setLoading(true)
    let orders = []

    if (useDummy) {
      orders = DUMMY_ORDERS
    } else {
      const now  = new Date()
      let from   = new Date()
      if (range === "today") { from.setHours(0,0,0,0) }
      if (range === "week")  { from.setDate(now.getDate() - now.getDay()); from.setHours(0,0,0,0) }
      if (range === "month") { from.setDate(1); from.setHours(0,0,0,0) }
      // Keep as local time, use +08:00 in query string
      const fromStr = from.getFullYear()+"-"+String(from.getMonth()+1).padStart(2,"0")+"-"+String(from.getDate()).padStart(2,"0")+"T00:00:00+08:00"

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", typeof fromStr!=="undefined" ? fromStr : from.toISOString())
        .order("created_at", { ascending: false })

      if (error) { console.error("Dashboard load error:", error); setLoading(false); return }
      orders = data || []
    }

    const today      = new Date().toISOString().slice(0, 10)
    const yest       = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const weekStart  = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0,10) })()
    const monthStart = new Date().toISOString().slice(0, 7) + "-01"

    const filterDate = (o) => {
      const d = o.created_at.slice(0, 10)
      if (range === "today") return d === today
      if (range === "week")  return d >= weekStart
      if (range === "month") return d >= monthStart
      return true
    }

    const periodOrders = useDummy ? orders.filter(filterDate) : orders
    const prevOrders   = useDummy ? orders.filter(o => o.created_at.slice(0,10) === yest) : []

    const paidOrders   = periodOrders.filter(o => o.status === "Paid" || !o.status || o.status === "paid")
    const openOrders   = periodOrders.filter(o => o.status === "Open" || o.status === "open")
    const totalSales   = paidOrders.reduce((s, o) => s + (o.total || 0), 0)
    const unpaidSales  = openOrders.reduce((s, o) => s + (o.total || 0), 0)
    const totalCogs    = paidOrders.reduce((s, o) => s + (o.cogs  || 0), 0)
    const prevSalesW   = useDummy ? prevOrders.reduce((s,o) => s+(o.total||0),0) : (window._dashPrev?.sales||0)
    const prevCountW   = useDummy ? prevOrders.length : (window._dashPrev?.orders||0)
    const prevSales    = prevSalesW
    const avgOrder     = paidOrders.length ? Math.round(totalSales / paidOrders.length) : 0
    const prevAvg      = prevCountW ? Math.round(prevSalesW / prevCountW) : 0
    const custSet      = new Set(paidOrders.filter(o => o.customer_id).map(o => o.customer_id))
    const totalProductsSold = paidOrders.reduce((s,o) => {
      const items = typeof o.items === "string" ? JSON.parse(o.items||"[]") : (o.items||o.items_snapshot||[])
      return s + (items||[]).reduce((ss,i) => ss+(i.qty||1), 0)
    }, 0)
    const prevProductsSold = 0
    const productsPerTx    = paidOrders.length ? Math.round(totalProductsSold / paidOrders.length * 10) / 10 : 0
    const mtdSales = useDummy ? totalSales : (window._dashMtd || totalSales)
    const dayOfMonth = new Date().getDate()
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()
    const projection = dayOfMonth > 0 ? Math.round(mtdSales / dayOfMonth * daysInMonth) : 0

    const payMap = {}
    periodOrders.forEach(o => {
      const m = o.pay || "Other"
      payMap[m] = (payMap[m] || 0) + (o.total || 0)
    })
    const payArr = Object.entries(payMap)
      .map(([method, amount]) => ({ method, amount, pct: totalSales ? Math.round(amount / totalSales * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount)

    const itemMap = {}
    periodOrders.forEach(o => {
      const items  = o.items_snapshot || o.order_items || o.items || []
      const parsed = typeof items === "string" ? JSON.parse(items) : items
      ;(parsed || []).forEach(i => {
        if (!itemMap[i.name]) itemMap[i.name] = { name:i.name, qty:0, revenue:0 }
        itemMap[i.name].qty     += (i.qty || 1)
        itemMap[i.name].revenue += (i.price || 0) * (i.qty || 1)
      })
    })
    const topArr = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 8)
    const maxQty = topArr[0]?.qty || 1

    const hMap = {}
    for (let h = 7; h <= 21; h++) hMap[h] = 0
    periodOrders.forEach(o => {
      const h = new Date(o.created_at).getHours()
      if (h >= 7 && h <= 21) hMap[h] = (hMap[h] || 0) + (o.total || 0)
    })
    const hourArr = Object.entries(hMap).map(([h, v]) => ({ hour: h + ":00", value: v }))
    const maxHour = Math.max(...hourArr.map(h => h.value), 1)

    setStats({ sales:totalSales, unpaidSales, orders:periodOrders.length, paidOrders:paidOrders.length, openOrders:openOrders.length, customers:custSet.size, avgOrder, prevAvg, grossProfit:totalSales - totalCogs, prevSales, totalProductsSold, productsPerTx, mtdSales, projection })
    setPayments(payArr)
    setTopItems(topArr.map(t => ({ ...t, maxQty })))
    setHourData(hourArr.map(h => ({ ...h, maxHour })))
    setRecent(periodOrders.slice(0, 30))
    setLoading(false)
  }

  const trend = stats.prevSales > 0
    ? Math.round((stats.sales - stats.prevSales) / stats.prevSales * 100)
    : null

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {[["today","Today"],["week","This Week"],["month","This Month"]].map(([v, l]) => (
          <button key={v} onClick={() => setRange(v)}
            className={"bo-btn bo-btn-sm " + (range === v ? "bo-btn-primary" : "bo-btn-ghost")}>
            {l}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {loading && <span style={{ fontSize:12, color:"var(--ink5)" }}>Loading…</span>}
          <button
            className={"bo-btn bo-btn-sm " + (useDummy ? "bo-btn-primary" : "bo-btn-ghost")}
            onClick={() => setUseDummy(d => !d)}>
            {useDummy ? "🎲 Demo ON" : "🎲 Demo"}
          </button>
        </div>
      </div>

      {/* Hero KPI Row */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
        {/* Total Sales - Hero */}
        <div style={{ background:"linear-gradient(135deg,#0052CC,#0066FF)", borderRadius:14, padding:"20px 24px", color:"#fff" }}>
          <div style={{ fontSize:11, fontWeight:700, opacity:0.8, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Total Penjualan</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:6 }}>
            <div style={{ fontSize:28, fontWeight:900, letterSpacing:"-0.5px" }}>{fmt(stats.sales)}</div>
            {trend !== null && <span style={{ fontSize:13, fontWeight:700, background: trend>=0?"rgba(0,255,128,0.2)":"rgba(255,80,80,0.2)", padding:"2px 8px", borderRadius:20, color: trend>=0?"#7fffc4":"#ffaaaa" }}>{trend>=0?"▲":"▼"} {Math.abs(trend)}%</span>}
          </div>
          <div style={{ fontSize:11, opacity:0.75 }}>
            {range==="today" ? "MTD "+fmt(stats.mtdSales)+"  ·  Proyeksi "+fmt(stats.projection) : stats.orders+" transaksi"}
          </div>
        </div>
        {/* Unpaid */}
        <div style={{ background:"#fff", borderRadius:14, padding:"20px 20px", border:"1.5px solid #FFF0B3" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#FF8B00", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Belum Dibayar</div>
          <div style={{ fontSize:24, fontWeight:900, color:"#FF8B00", marginBottom:6 }}>{fmt(stats.unpaidSales)}</div>
          <div style={{ fontSize:11, color:"#FF8B00", opacity:0.7 }}>Open bills</div>
        </div>
        {/* Paid */}
        <div style={{ background:"#fff", borderRadius:14, padding:"20px 20px", border:"1.5px solid #ABF5D1" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#00875A", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px" }}>Sudah Dibayar</div>
          <div style={{ fontSize:24, fontWeight:900, color:"#00875A", marginBottom:6 }}>{fmt(stats.sales)}</div>
          <div style={{ fontSize:11, color:"#00875A", opacity:0.7 }}>{stats.orders} transaksi</div>
        </div>
      </div>

      {/* Secondary KPI Row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
        {[
          { label:"Transaksi",        value:stats.orders,             sub:"orders paid",        color:"#0052CC",      prev:null },
          { label:"Produk Terjual",   value:stats.totalProductsSold,  sub:"total items",        color:"#6554C0",      prev:null },
          { label:"Rata-rata/Order",  value:fmt(stats.avgOrder),      sub:"per transaksi",      color:"var(--ink1)",  prev:stats.prevAvg },
          { label:"Item/Transaksi",   value:stats.productsPerTx,      sub:"avg per order",      color:"var(--ink1)",  prev:null },
          { label:"Gross Profit",     value:fmt(stats.grossProfit),   sub:"Margin "+(stats.sales>0?Math.round(stats.grossProfit/stats.sales*100):0)+"%", color:stats.grossProfit>0?"var(--green)":"var(--red)", prev:null },
        ].map(k => {
          const chg = k.prev > 0 ? Math.round((parseFloat(String(k.value).replace(/[^0-9]/g,"")) - k.prev) / k.prev * 100) : null
          return (
            <div key={k.label} style={{ background:"#fff", borderRadius:12, padding:"14px 16px", border:"1px solid var(--surface3)" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"var(--ink4)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.4px" }}>{k.label}</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:5, flexWrap:"wrap" }}>
                <div style={{ fontSize:18, fontWeight:900, color:k.color }}>{k.value}</div>
                {chg !== null && <span style={{ fontSize:10, fontWeight:700, color:chg>=0?"var(--green)":"var(--red)" }}>{chg>=0?"▲":"▼"}{Math.abs(chg)}%</span>}
              </div>
              <div style={{ fontSize:10, color:"var(--ink5)", marginTop:4 }}>{k.sub}</div>
            </div>
          )
        })}
      </div>

      <div className="bo-card" style={{ marginBottom:16 }}>
        <div className="bo-card-title">
          Sales by Hour
          {!useDummy && hourData.every(h => h.value === 0) &&
            <span style={{ fontSize:11, color:"var(--ink5)", fontWeight:400, marginLeft:8 }}>— no data yet</span>}
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:80 }}>
          {hourData.map(h => {
            const pct    = h.maxHour > 0 ? Math.max(4, Math.round(h.value / h.maxHour * 100)) : 4
            const active = h.value > 0
            return (
              <div key={h.hour} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div title={fmt(h.value)} style={{
                  width:"100%", height: pct * 0.76 + "%", minHeight:4,
                  borderRadius:"3px 3px 0 0",
                  background: active ? "var(--brand)" : "var(--surface2)",
                  transition:"height 0.3s"
                }} />
                <span style={{ fontSize:9, color:"var(--ink5)", whiteSpace:"nowrap" }}>{h.hour.replace(":00","")}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title">Payment Methods</div>
          {payments.length === 0
            ? <div style={{ color:"var(--ink5)", fontSize:13, padding:"12px 0" }}>No data — click 🎲 Demo</div>
            : payments.map(p => (
              <div key={p.method} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"var(--ink)", display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background: PAY_COLORS[p.method] || "var(--ink4)", display:"inline-block" }} />
                    {p.method}
                  </span>
                  <span style={{ fontSize:12, fontWeight:700, color:"var(--ink3)" }}>{fmt(p.amount)}</span>
                </div>
                <div style={{ height:5, background:"var(--surface2)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width: p.pct + "%", background: PAY_COLORS[p.method] || "var(--ink4)", borderRadius:3, transition:"width 0.4s" }} />
                </div>
                <div style={{ fontSize:10, color:"var(--ink5)", marginTop:2 }}>{p.pct}% of sales</div>
              </div>
            ))
          }
        </div>

        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title">Top Items <span style={{ fontSize:11, color:"var(--ink5)", fontWeight:400 }}>by qty sold</span></div>
          {topItems.length === 0
            ? <div style={{ color:"var(--ink5)", fontSize:13, padding:"12px 0" }}>No data — click 🎲 Demo</div>
            : topItems.map((item, i) => (
              <div key={item.name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{
                  width:22, height:22, borderRadius:"50%",
                  background: i < 3 ? "var(--brand)" : "var(--surface2)",
                  color: i < 3 ? "#fff" : "var(--ink4)",
                  fontSize:10, fontWeight:800,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0
                }}>{i + 1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"var(--ink)", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                  <div style={{ height:4, background:"var(--surface2)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width: Math.round(item.qty / item.maxQty * 100) + "%", background:"var(--brand)", borderRadius:2 }} />
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--brand)" }}>{item.qty}x</div>
                  <div style={{ fontSize:10, color:"var(--ink5)" }}>{fmt(item.revenue)}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      <div className="bo-card" style={{ marginBottom:16 }}>
        <div className="bo-card-title">P&amp;L Summary</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)" }}>
          {[
            { label:"Gross Revenue", val: fmt(stats.sales),                      color:"var(--ink)" },
            { label:"Est. COGS",     val: fmt(stats.sales - stats.grossProfit),  color:"var(--red)" },
            { label:"Gross Profit",  val: fmt(stats.grossProfit),                color: stats.grossProfit >= 0 ? "var(--green)" : "var(--red)" },
          ].map((r, i) => (
            <div key={r.label} style={{ padding:"14px 20px", borderRight: i < 2 ? "1px solid var(--surface3)" : "none", textAlign:"center" }}>
              <div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>{r.label}</div>
              <div style={{ fontSize:20, fontWeight:800, color: r.color, letterSpacing:"-0.5px" }}>{r.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bo-card">
        <div className="bo-card-title">
          Semua Transaksi
          <span style={{ fontSize:11, color:"var(--ink5)", fontWeight:400, marginLeft:8 }}>{stats.paidOrders||0} lunas · {stats.openOrders||0} open bill</span>
        </div>
        <table className="bo-table">
          <thead>
            <tr><th>Order</th><th>Status</th><th>Table</th><th>Staff</th><th>Payment</th><th>Total</th><th>Time</th></tr>
          </thead>
          <tbody>
            {recent.length === 0
              ? <tr><td colSpan={7} style={{ textAlign:"center", color:"var(--ink5)", padding:"28px 0" }}>No orders yet — click 🎲 Demo to preview</td></tr>
              : recent.map(o => {
                  const isPaid   = !o.status || o.status === "Paid" || o.status === "paid"
                  const badge    = statusBadge(o.status)
                  const payBadge = { Cash:"bo-badge-green", QRIS:"bo-badge-blue", Card:"bo-badge-blue", GoPay:"bo-badge-blue", OVO:"bo-badge-amber" }
                  const timeStr  = new Date(o.created_at).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })
                  return (
                    <tr key={o.id} onClick={() => setSelectedOrder(o)}
                      style={{ cursor:"pointer" }}
                      className="bo-table-row-hover">
                      <td style={{ fontWeight:600,color:"var(--brand)" }}>{o.code || "#" + String(o.id).slice(-6)}</td>
                      <td><span style={{ fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:badge.bg,color:badge.color }}>{badge.label}</span></td>
                      <td>{o.table_name || o.table || "Walk-in"}</td>
                      <td style={{ color:"var(--ink3)" }}>{o.staff || "-"}</td>
                      <td><span className={"bo-badge " + (isPaid?(payBadge[o.pay]||"bo-badge-amber"):"bo-badge-gray")}>{isPaid?(o.pay||"—"):"—"}</span></td>
                      <td style={{ fontWeight:700,color:isPaid?"inherit":badge.color }}>{fmt(o.total)}</td>
                      <td style={{ color:"var(--ink5)" }}>{o.time || timeStr}</td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  )
}
