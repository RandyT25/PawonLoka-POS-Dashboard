import { useState, useEffect, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"

const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID")
const PAY_COLORS = { Cash:"#10B981", QRIS:"#0EA5E9", Card:"#1565C0", GoPay:"#00ADE0", OVO:"#8B5CF6", Other:"#94A3B8" }

export default function SalesAnalysis() {
  const todayStr  = new Date().toISOString().slice(0, 10)
  const [range,      setRange]      = useState("today")
  const [customDate, setCustomDate] = useState(todayStr)
  const [loading,    setLoading]    = useState(true)

  const [summary,  setSummary]  = useState({ revenue:0, cogs:0, profit:0, orders:0, avg:0, margin:0 })
  const [payments, setPayments] = useState([])
  const [byDay,    setByDay]    = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const { fromStr, toStr } = buildDateRange(range, customDate)
    let q = supabase.from("orders")
      .select("id,created_at,total,pay,status,cogs,discount,tax")
      .in("status", ["Paid", "paid", null])
      .gte("created_at", fromStr)
    if (toStr) q = q.lte("created_at", toStr)
    const { data, error } = await q.order("created_at", { ascending: false })
    if (error) { console.error(error); setLoading(false); return }

    const orders = (data || []).filter(o => !o.status || o.status === "Paid" || o.status === "paid")

    // Summary
    const revenue = orders.reduce((s, o) => s + (o.total || 0), 0)
    const cogs    = orders.reduce((s, o) => s + (o.cogs  || 0), 0)
    const profit  = revenue - cogs
    const avg     = orders.length ? Math.round(revenue / orders.length) : 0
    const margin  = revenue > 0 ? Math.round(profit / revenue * 100) : 0
    setSummary({ revenue, cogs, profit, orders:orders.length, avg, margin })

    // Payment methods
    const payMap = {}
    orders.forEach(o => {
      const m = o.pay || "Other"
      payMap[m] = (payMap[m] || 0) + (o.total || 0)
    })
    const payArr = Object.entries(payMap)
      .map(([method, amount]) => ({ method, amount, pct: revenue ? Math.round(amount / revenue * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount)
    setPayments(payArr)

    // Day-by-day (only meaningful for week/month)
    const dayMap = {}
    orders.forEach(o => {
      const d = o.created_at?.slice(0, 10) || "?"
      if (!dayMap[d]) dayMap[d] = { date:d, orders:0, revenue:0, cogs:0 }
      dayMap[d].orders++
      dayMap[d].revenue += o.total || 0
      dayMap[d].cogs    += o.cogs  || 0
    })
    const dayArr = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date))
    setByDay(dayArr)

    setLoading(false)
  }, [range, customDate])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel("sales_analysis_rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"orders" }, () => load())
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"orders" }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const maxPay = payments[0]?.amount || 1

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate} loading={loading} />

      {/* ── P&L Summary ───────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
        {[
          { label:"Gross Revenue",  value:fmt(summary.revenue), color:"var(--ink)",  sub:`${summary.orders} transaksi · avg ${fmt(summary.avg)}` },
          { label:"Est. COGS",      value:fmt(summary.cogs),    color:"#DC2626",     sub:"Estimasi harga pokok" },
          { label:"Gross Profit",   value:fmt(summary.profit),  color:summary.profit >= 0 ? "#059669" : "#DC2626", sub:`Margin ${summary.margin}%` },
        ].map(k => (
          <div key={k.label} style={{ background:"#fff", borderRadius:14, padding:"20px 22px", border:"1px solid var(--surface3)" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--ink4)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:900, color:k.color, letterSpacing:"-0.5px", marginBottom:4 }}>{k.value}</div>
            <div style={{ fontSize:11, color:"var(--ink5)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>

        {/* ── Payment Methods ─────────────────────────── */}
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title">Metode Pembayaran</div>
          {payments.length === 0
            ? <div style={{ color:"var(--ink5)", fontSize:13, padding:"20px 0", textAlign:"center" }}>Belum ada data</div>
            : payments.map(p => (
              <div key={p.method} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, fontWeight:600 }}>
                    <span style={{ width:10, height:10, borderRadius:"50%", background:PAY_COLORS[p.method] || "#94A3B8", display:"inline-block", flexShrink:0 }} />
                    {p.method}
                  </span>
                  <span style={{ fontSize:13, fontWeight:700 }}>{fmt(p.amount)}</span>
                </div>
                <div style={{ height:6, background:"var(--surface2)", borderRadius:4, overflow:"hidden" }}>
                  <div style={{
                    height:"100%",
                    width: Math.round(p.amount / maxPay * 100) + "%",
                    background: PAY_COLORS[p.method] || "#94A3B8",
                    borderRadius:4, transition:"width 0.4s",
                  }} />
                </div>
                <div style={{ fontSize:10, color:"var(--ink5)", marginTop:3 }}>{p.pct}% dari total penjualan</div>
              </div>
            ))
          }
        </div>

        {/* ── Profit margin visual ─────────────────────── */}
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title">Komposisi Penjualan</div>
          {summary.revenue === 0
            ? <div style={{ color:"var(--ink5)", fontSize:13, padding:"20px 0", textAlign:"center" }}>Belum ada data</div>
            : (
              <>
                {[
                  { label:"Gross Profit", value:summary.profit, pct:summary.margin,    color:"#059669" },
                  { label:"COGS",         value:summary.cogs,   pct:100-summary.margin, color:"#EF4444" },
                ].map(r => (
                  <div key={r.label} style={{ marginBottom:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>{r.label}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:r.color }}>{r.pct}% · {fmt(r.value)}</span>
                    </div>
                    <div style={{ height:10, background:"var(--surface2)", borderRadius:6, overflow:"hidden" }}>
                      <div style={{ height:"100%", width: Math.max(r.pct, 0) + "%", background:r.color, borderRadius:6, transition:"width 0.5s" }} />
                    </div>
                  </div>
                ))}
                <div style={{ borderTop:"1px solid var(--surface3)", paddingTop:14, marginTop:6 }}>
                  <div style={{ fontSize:11, color:"var(--ink4)", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.4px" }}>Break-even indicator</div>
                  <div style={{ fontSize:20, fontWeight:900, color: summary.margin >= 30 ? "#059669" : summary.margin >= 15 ? "#F59E0B" : "#DC2626" }}>
                    {summary.margin >= 30 ? "✓ Sehat" : summary.margin >= 15 ? "⚠ Perlu perhatian" : "✗ Margin tipis"}
                  </div>
                  <div style={{ fontSize:11, color:"var(--ink5)", marginTop:2 }}>Target margin: ≥ 30%</div>
                </div>
              </>
            )
          }
        </div>
      </div>

      {/* ── Day-by-day breakdown (week/month only) ──── */}
      {(range === "week" || range === "month") && byDay.length > 0 && (
        <div className="bo-card">
          <div className="bo-card-title">Penjualan per Hari</div>
          <table className="bo-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th style={{ textAlign:"right" }}>Transaksi</th>
                <th style={{ textAlign:"right" }}>Revenue</th>
                <th style={{ textAlign:"right" }}>COGS</th>
                <th style={{ textAlign:"right" }}>Profit</th>
                <th style={{ textAlign:"right" }}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {byDay.map(d => {
                const profit = d.revenue - d.cogs
                const margin = d.revenue > 0 ? Math.round(profit / d.revenue * 100) : 0
                const dateLabel = new Date(d.date + "T12:00:00").toLocaleDateString("id-ID", { weekday:"short", day:"numeric", month:"short" })
                return (
                  <tr key={d.date}>
                    <td style={{ fontWeight:600 }}>{dateLabel}</td>
                    <td style={{ textAlign:"right" }}>{d.orders}</td>
                    <td style={{ textAlign:"right", fontWeight:700 }}>{fmt(d.revenue)}</td>
                    <td style={{ textAlign:"right", color:"#EF4444" }}>{fmt(d.cogs)}</td>
                    <td style={{ textAlign:"right", fontWeight:700, color: profit >= 0 ? "#059669" : "#DC2626" }}>{fmt(profit)}</td>
                    <td style={{ textAlign:"right", color: margin >= 30 ? "#059669" : margin >= 15 ? "#F59E0B" : "#DC2626", fontWeight:700 }}>{margin}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
