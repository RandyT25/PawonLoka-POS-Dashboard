import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../../lib/supabase"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"

const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID")

function statusBadge(s) {
  if (!s || s === "Paid"    || s === "paid")     return { label:"Lunas",     bg:"#D1FAE5", color:"#065F46" }
  if (s === "Open"          || s === "open")      return { label:"Open Bill", bg:"#FEF3C7", color:"#92400E" }
  if (s === "Voided"        || s === "voided")    return { label:"Void",      bg:"#F1F5F9", color:"#64748B" }
  if (s === "Refunded"      || s === "refunded")  return { label:"Refund",    bg:"#EDE9FE", color:"#5B21B6" }
  return { label: s, bg:"#F1F5F9", color:"#64748B" }
}

export default function Dashboard() {
  const todayStr  = new Date().toISOString().slice(0, 10)
  const [range,      setRange]      = useState("today")
  const [customDate,   setCustomDate]   = useState(todayStr)
  const [customDateTo, setCustomDateTo] = useState(todayStr)
  const [loading,    setLoading]    = useState(true)
  const [stats,      setStats]      = useState({ sales:0, unpaidSales:0, paidOrders:0, openOrders:0, avgOrder:0, grossProfit:0, prevSales:0, totalProductsSold:0, projection:0, mtdSales:0 })
  const [hourData,   setHourData]   = useState([])
  const [payments,   setPayments]   = useState([])
  const [topProds,   setTopProds]   = useState([])
  const [recent,     setRecent]     = useState([])
  const [selected,   setSelected]   = useState(null)
  const [lastUpdated,setLastUpdated]= useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { fromStr, toStr } = buildDateRange(range, customDate, customDateTo)
    let q = supabase.from("orders").select("*").gte("created_at", fromStr)
    if (toStr) q = q.lte("created_at", toStr)
    const { data, error } = await q.order("created_at", { ascending: false })
    if (error) { console.error(error); setLoading(false); return }
    const orders = data || []

    const paid   = orders.filter(o => !o.status || o.status === "Paid"  || o.status === "paid")
    const open   = orders.filter(o =>  o.status === "Open"  || o.status === "open")
    const totalSales  = paid.reduce((s, o) => s + (o.total || 0), 0)
    const unpaidSales = open.reduce((s, o) => s + (o.total || 0), 0)
    const totalCogs   = paid.reduce((s, o) => s + (o.cogs  || 0), 0)
    const avgOrder    = paid.length ? Math.round(totalSales / paid.length) : 0
    const totalProd   = paid.reduce((s, o) => {
      const items = typeof o.items === "string" ? JSON.parse(o.items || "[]") : (o.items || o.items_snapshot || [])
      return s + (items || []).reduce((ss, i) => ss + (i.qty || 1), 0)
    }, 0)

    // Hourly sales (7–21)
    const hMap = {}
    for (let h = 7; h <= 21; h++) hMap[h] = 0
    paid.forEach(o => {
      const h = new Date(o.created_at).getHours()
      if (h >= 7 && h <= 21) hMap[h] = (hMap[h] || 0) + (o.total || 0)
    })
    const maxHour = Math.max(...Object.values(hMap), 1)
    const hourArr = Object.entries(hMap).map(([h, v]) => ({ hour: h + ":00", value: v, maxHour }))

    // Month projection (only meaningful for "today" range)
    const day  = new Date().getDate()
    const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const proj = day > 0 ? Math.round(totalSales / day * days) : 0

    // Payment method breakdown
    const pm = {}
    paid.forEach(o => { const m = o.pay||"Other"; pm[m] = (pm[m]||0)+(o.total||0) })
    const payArr = Object.entries(pm).map(([method,amount]) => ({ method, amount, pct: totalSales ? Math.round(amount/totalSales*100) : 0 })).sort((a,b) => b.amount-a.amount)

    // Top 5 products by qty
    const im = {}
    paid.forEach(o => {
      const its = typeof o.items==="string" ? JSON.parse(o.items||"[]") : (o.items||o.items_snapshot||[])
      ;(its||[]).forEach(i => { if(!im[i.name]) im[i.name]={name:i.name,qty:0}; im[i.name].qty+=(i.qty||1) })
    })
    const topArr = Object.values(im).sort((a,b)=>b.qty-a.qty).slice(0,5)
    const maxQty = topArr[0]?.qty||1

    setStats({ sales:totalSales, unpaidSales, paidOrders:paid.length, openOrders:open.length, avgOrder, grossProfit:totalSales - totalCogs, totalProductsSold:totalProd, projection:proj, mtdSales:totalSales })
    setHourData(hourArr)
    setPayments(payArr)
    setTopProds(topArr.map(t=>({...t,max:maxQty})))
    setRecent(orders.slice(0, 20))
    setLastUpdated(new Date())
    setLoading(false)
  }, [range, customDate, customDateTo])

  // loadRef — always points to latest load(), prevents stale closure in interval/realtime
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel("dashboard_rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"orders" }, () => loadRef.current())
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"orders" }, () => loadRef.current())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // 10-second polling + immediate reload on tab focus (guaranteed refresh regardless of realtime)
  useEffect(() => {
    const poll = setInterval(() => { if (!document.hidden) loadRef.current() }, 10000)
    const onVisible = () => { if (!document.hidden) loadRef.current() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(poll); document.removeEventListener("visibilitychange", onVisible) }
  }, [])

  const margin = stats.sales > 0 ? Math.round(stats.grossProfit / stats.sales * 100) : 0

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate} customDateTo={customDateTo} setCustomDateTo={setCustomDateTo} loading={loading} lastUpdated={lastUpdated} onRefresh={() => loadRef.current()} />

      {/* ── Hero ─────────────────────────────────────── */}
      <div style={{ background:"linear-gradient(135deg,#0A1628,#0052CC)", borderRadius:16, padding:"22px 24px", color:"#fff", marginBottom:12 }}>
        {/* Grand total */}
        <div style={{ fontSize:11, fontWeight:700, opacity:0.5, textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:4 }}>Total Keseluruhan</div>
        <div style={{ fontSize:34, fontWeight:900, letterSpacing:"-1px", marginBottom:2 }}>{fmt(stats.sales + stats.unpaidSales)}</div>
        <div style={{ fontSize:11, opacity:0.45, marginBottom:18 }}>Sudah dibayar + belum dibayar</div>

        {/* Sudah / Belum row */}
        <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, opacity:0.6, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>✓ Sudah Dibayar</div>
            <div style={{ fontSize:22, fontWeight:900 }}>{fmt(stats.sales)}</div>
            <div style={{ fontSize:11, opacity:0.5, marginTop:1 }}>{stats.paidOrders} transaksi lunas</div>
          </div>
          <div style={{ width:1, background:"rgba(255,255,255,0.15)", alignSelf:"stretch" }}/>
          <div>
            <div style={{ fontSize:10, fontWeight:700, opacity:0.6, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>⏳ Belum Dibayar</div>
            <div style={{ fontSize:22, fontWeight:900, color: stats.unpaidSales > 0 ? "#FCD34D" : "rgba(255,255,255,0.3)" }}>{fmt(stats.unpaidSales)}</div>
            <div style={{ fontSize:11, opacity:0.5, marginTop:1 }}>{stats.openOrders} open bill</div>
          </div>
        </div>

        {/* Meta bar */}
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:11, borderTop:"1px solid rgba(255,255,255,0.12)", paddingTop:12 }}>
          <span style={{ opacity:0.6 }}>Avg/Transaksi <strong style={{ opacity:1 }}>{fmt(stats.avgOrder)}</strong></span>
          <span style={{ opacity:0.6 }}>Gross Profit <strong style={{ opacity:1, color: stats.grossProfit >= 0 ? "#86EFAC" : "#FCA5A5" }}>{fmt(stats.grossProfit)}</strong> <span style={{ opacity:0.7 }}>({margin}%)</span></span>
          <span style={{ opacity:0.6 }}>Proyeksi Bulan Ini <strong style={{ opacity:1 }}>{fmt(stats.projection)}</strong></span>
        </div>
      </div>

      {/* ── 2-column: Chart + Side panel ─────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:12, marginBottom:12 }}>

        {/* Sales by Hour — taller, with value labels */}
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title">
            Penjualan per Jam
            {hourData.every(h => h.value === 0) && <span style={{ fontSize:11, color:"var(--ink5)", fontWeight:400, marginLeft:8 }}>— belum ada data</span>}
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:130, paddingTop:8 }}>
            {hourData.map(h => {
              const pct    = h.maxHour > 0 ? Math.max(3, Math.round(h.value / h.maxHour * 100)) : 3
              const active = h.value > 0
              return (
                <div key={h.hour} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, height:"100%" }}>
                  <div style={{ flex:1, display:"flex", alignItems:"flex-end", width:"100%" }}>
                    <div title={active ? fmt(h.value) : ""} style={{
                      width:"100%", height: pct + "%", minHeight:3,
                      borderRadius:"3px 3px 0 0",
                      background: active ? "var(--brand)" : "var(--surface2)",
                      transition:"height 0.3s",
                      cursor: active ? "default" : "default",
                    }} />
                  </div>
                  <span style={{ fontSize:8, color:"var(--ink5)", whiteSpace:"nowrap" }}>{h.hour.replace(":00","")}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Side panel: payment methods + top products */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Payment methods */}
          <div className="bo-card" style={{ marginBottom:0, flex:1 }}>
            <div className="bo-card-title" style={{ marginBottom:10 }}>Metode Pembayaran</div>
            {payments.length === 0
              ? <div style={{ fontSize:12, color:"var(--ink5)" }}>Belum ada transaksi</div>
              : payments.map(p => (
                <div key={p.method} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:12 }}>
                    <span style={{ fontWeight:600, color:"var(--ink1)" }}>{p.method}</span>
                    <span style={{ fontWeight:700, color:"var(--brand)" }}>{p.pct}%</span>
                  </div>
                  <div style={{ height:5, background:"var(--surface2)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:p.pct+"%", background:"var(--brand)", borderRadius:3 }}/>
                  </div>
                  <div style={{ fontSize:10, color:"var(--ink5)", marginTop:2 }}>{fmt(p.amount)}</div>
                </div>
              ))
            }
          </div>

          {/* Top products */}
          <div className="bo-card" style={{ marginBottom:0, flex:1 }}>
            <div className="bo-card-title" style={{ marginBottom:10 }}>Top Produk</div>
            {topProds.length === 0
              ? <div style={{ fontSize:12, color:"var(--ink5)" }}>Belum ada data</div>
              : topProds.map((p,i) => (
                <div key={p.name} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ width:20, height:20, borderRadius:"50%", flexShrink:0, background:i===0?"#F59E0B":i===1?"#94A3B8":i===2?"#B45309":"#F1F5F9", color:i<3?"#fff":"#64748B", fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:"var(--ink1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:"var(--brand)", flexShrink:0, marginLeft:6 }}>{p.qty}×</span>
                    </div>
                    <div style={{ height:4, background:"var(--surface2)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:Math.round(p.qty/p.max*100)+"%", background:"var(--brand)", borderRadius:2 }}/>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── Recent Transactions ───────────────────────── */}
      <div className="bo-card">
        <div className="bo-card-title">
          Transaksi Terbaru
          <span style={{ fontSize:11, color:"var(--ink5)", fontWeight:400, marginLeft:8 }}>
            {stats.paidOrders} lunas · {stats.openOrders} open
          </span>
        </div>
        {selected && (
          <div style={{ background:"var(--surface)", borderRadius:12, padding:14, marginBottom:12, fontSize:13 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontWeight:800 }}>{selected.code || "#" + String(selected.id).slice(-6)}</div>
              <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:"var(--ink4)" }}>✕</button>
            </div>
            {(() => {
              const items = selected.items_snapshot || selected.items || []
              const parsed = typeof items === "string" ? JSON.parse(items) : items
              return (parsed || []).map((i, idx) => (
                <div key={idx} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid var(--surface3)" }}>
                  <span>{i.qty}× {i.name}</span>
                  <span style={{ fontWeight:600 }}>{fmt((i.price || 0) * (i.qty || 1))}</span>
                </div>
              ))
            })()}
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, marginTop:8 }}>
              <span>Total</span><span>{fmt(selected.total)}</span>
            </div>
          </div>
        )}
        <table className="bo-table">
          <thead>
            <tr><th>Order</th><th>Status</th><th>Meja</th><th>Staff</th><th>Pembayaran</th><th>Total</th><th>Waktu</th></tr>
          </thead>
          <tbody>
            {recent.length === 0
              ? <tr><td colSpan={7} style={{ textAlign:"center", color:"var(--ink5)", padding:"28px 0" }}>Belum ada transaksi hari ini</td></tr>
              : recent.map(o => {
                  const badge   = statusBadge(o.status)
                  const isPaid  = !o.status || o.status === "Paid" || o.status === "paid"
                  const timeStr = new Date(o.created_at).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })
                  return (
                    <tr key={o.id} onClick={() => setSelected(selected?.id === o.id ? null : o)}
                      style={{ cursor:"pointer" }} className="bo-table-row-hover">
                      <td style={{ fontWeight:700, color:"var(--brand)" }}>{o.code || "#" + String(o.id).slice(-6)}</td>
                      <td><span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, background:badge.bg, color:badge.color }}>{badge.label}</span></td>
                      <td>{o.table_name || o.table || "Walk-in"}</td>
                      <td style={{ color:"var(--ink3)" }}>{o.staff || "—"}</td>
                      <td><span className={"bo-badge " + (isPaid ? "bo-badge-green" : "bo-badge-gray")}>{isPaid ? (o.pay || "—") : "—"}</span></td>
                      <td style={{ fontWeight:700 }}>{fmt(o.total)}</td>
                      <td style={{ color:"var(--ink5)" }}>{o.time || timeStr}</td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
