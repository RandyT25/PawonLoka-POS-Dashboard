import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase } from "../../lib/supabase"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"
import MultiItemSelect from "./MultiItemSelect"
import { exportPDF, exportExcel, formatPeriodLabel, filenameSlug, fmtIDR } from "./exportUtils"
import { explodeOrderPayments, computeOrderCommission } from "../../shared/orderPricing"

const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID")
const PAY_COLORS = {
  Cash:"#10B981", QRIS:"#0EA5E9", Card:"#1565C0", "Debit/Credit":"#1565C0", Transfer:"#6366F1",
  GoFood:"#EF4444", GrabFood:"#00B14F", ShopeeFood:"#EE4D2D",
  GoPay:"#00ADE0", OVO:"#8B5CF6", ShopeePay:"#EE4D2D", DANA:"#118EEA", Other:"#94A3B8"
}

export default function SalesAnalysis() {
  const todayStr  = new Date().toISOString().slice(0, 10)
  const [range,      setRange]      = useState("today")
  const [customDate,   setCustomDate]   = useState(todayStr)
  const [customDateTo, setCustomDateTo] = useState(todayStr)
  const [loading,      setLoading]      = useState(true)
  const [err,          setErr]          = useState(null)
  const [lastUpdated,  setLastUpdated]  = useState(null)

  const [itemFilter,  setItemFilter]  = useState(new Set())
  const [rawOrders,   setRawOrders]  = useState([])
  const [summary,  setSummary]  = useState({ revenue:0, commission:0, netRevenue:0, cogs:0, profit:0, orders:0, avg:0, margin:0 })
  const [payments, setPayments] = useState([])
  const [byDay,    setByDay]    = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const { fromStr, toStr } = buildDateRange(range, customDate, customDateTo)
    let q = supabase.from("orders").select("*").gte("created_at", fromStr)
    if (toStr) q = q.lte("created_at", toStr)
    const { data, error } = await q.order("created_at", { ascending: false })
    if (error) { console.error(error); setErr(error.message); setLoading(false); return }
    setRawOrders((data || []).filter(o => !o.status || o.status === "Paid" || o.status === "paid"))
    setLastUpdated(new Date())
    setLoading(false)
  }, [range, customDate, customDateTo])

  const parseItems = o => {
    const raw = o.items_snapshot || o.items || []
    return typeof raw === "string" ? JSON.parse(raw || "[]") : (raw || [])
  }

  const allItemNames = useMemo(() => {
    const names = new Set()
    rawOrders.forEach(o => parseItems(o).forEach(i => { if (i.name) names.add(i.name) }))
    return [...names].sort()
  }, [rawOrders])

  const filteredOrders = useMemo(() => {
    if (itemFilter.size === 0) return rawOrders
    return rawOrders.filter(o => parseItems(o).some(i => itemFilter.has(i.name)))
  }, [rawOrders, itemFilter])

  useEffect(() => {
    const revenue    = filteredOrders.reduce((s, o) => s + (o.total || 0), 0)
    const commission = filteredOrders.reduce((s, o) => s + computeOrderCommission(o).commission, 0)
    const netRevenue = revenue - commission
    const cogs       = filteredOrders.reduce((s, o) => s + (o.cogs  || 0), 0)
    const profit     = netRevenue - cogs
    const avg        = filteredOrders.length ? Math.round(revenue / filteredOrders.length) : 0
    const margin     = netRevenue > 0 ? Math.round(profit / netRevenue * 100) : 0
    setSummary({ revenue, commission, netRevenue, cogs, profit, orders:filteredOrders.length, avg, margin })

    const payMap = {}
    const payCommMap = {}
    filteredOrders.forEach(o => {
      const oComm = computeOrderCommission(o)
      explodeOrderPayments(o).forEach(({ method, amount }) => {
        payMap[method] = (payMap[method] || 0) + amount
        const ratio = (o.total || 0) > 0 ? amount / o.total : 1
        payCommMap[method] = (payCommMap[method] || 0) + Math.round(oComm.commission * ratio)
      })
    })
    setPayments(Object.entries(payMap)
      .map(([method, amount]) => {
        const comm = payCommMap[method] || 0
        return { method, amount, commission: comm, netAmount: amount - comm, pct: revenue ? Math.round(amount / revenue * 100) : 0 }
      })
      .sort((a, b) => b.amount - a.amount))

    const dayMap = {}
    filteredOrders.forEach(o => {
      const d = o.created_at?.slice(0, 10) || "?"
      const oComm = computeOrderCommission(o)
      if (!dayMap[d]) dayMap[d] = { date:d, orders:0, revenue:0, commission:0, netRevenue:0, cogs:0 }
      dayMap[d].orders++
      dayMap[d].revenue    += o.total || 0
      dayMap[d].commission += oComm.commission
      dayMap[d].netRevenue += oComm.netRevenue
      dayMap[d].cogs       += o.cogs  || 0
    })
    setByDay(Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date)))
  }, [filteredOrders])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel("sales_analysis_rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"orders" }, () => loadRef.current())
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"orders" }, () => loadRef.current())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  useEffect(() => {
    const poll = setInterval(() => { if (!document.hidden) loadRef.current() }, 10000)
    const onVisible = () => { if (!document.hidden) loadRef.current() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(poll); document.removeEventListener("visibilitychange", onVisible) }
  }, [])

  const maxPay = payments[0]?.amount || 1
  const filterLabel = itemFilter.size > 0 ? [...itemFilter].join(", ") : null
  const periodLabel = formatPeriodLabel(range, customDate, customDateTo)
  const slug = filenameSlug(range, customDate, customDateTo)

  function handleExportExcel() {
    exportExcel({
      title: "Analisis Penjualan", periodLabel, filterLabel,
      filename: "pawonloka-analisis-" + slug + ".xlsx",
      sheets: [
        {
          name: "Ringkasan",
          columns: ["Metrik", "Nilai"],
          colWidths: [28, 22],
          rows: [
            ["Gross Revenue",            fmtIDR(summary.revenue)],
            ["Komisi Platform (20%)",    fmtIDR(summary.commission)],
            ["Net Store Revenue",        fmtIDR(summary.netRevenue)],
            ["Est. COGS",                fmtIDR(summary.cogs)],
            ["Gross Profit (After Comm)",fmtIDR(summary.profit)],
            ["Margin",                   summary.margin + "%"],
            ["Total Transaksi",          summary.orders],
            ["Avg per Order",            fmtIDR(summary.avg)],
          ],
        },
        {
          name: "Per Hari",
          columns: ["Tanggal","Transaksi","Gross Revenue","Komisi Platform","Net Store","COGS","Profit","Margin"],
          colWidths: [20,12,20,18,20,18,20,12],
          rows: byDay.map(d => {
            const p = d.netRevenue - d.cogs
            return [
              new Date(d.date + "T12:00:00").toLocaleDateString("id-ID"),
              d.orders, fmtIDR(d.revenue), fmtIDR(d.commission), fmtIDR(d.netRevenue), fmtIDR(d.cogs),
              fmtIDR(p), (d.netRevenue > 0 ? Math.round(p/d.netRevenue*100) : 0) + "%",
            ]
          }),
        },
        {
          name: "Pembayaran",
          columns: ["Metode","Gross Jumlah","Komisi Platform","Net Diterima","Persen"],
          colWidths: [20,20,18,20,12],
          rows: payments.map(p => [p.method, fmtIDR(p.amount), fmtIDR(p.commission || 0), fmtIDR(p.netAmount ?? p.amount), p.pct + "%"]),
        },
      ],
    })
  }

  function handleExportPdf() {
    const tables = [
      {
        label: "Ringkasan P&L",
        head: ["Metrik", "Nilai"],
        body: [
          ["Gross Revenue",            fmtIDR(summary.revenue)],
          ["Komisi Platform (20%)",    fmtIDR(summary.commission)],
          ["Net Store Revenue",        fmtIDR(summary.netRevenue)],
          ["Est. COGS",                fmtIDR(summary.cogs)],
          ["Gross Profit (After Comm)",fmtIDR(summary.profit)],
          ["Margin",                   summary.margin + "%"],
          ["Total Transaksi",          summary.orders],
          ["Avg per Order",            fmtIDR(summary.avg)],
        ],
      },
      ...(payments.length > 0 ? [{
        label: "Metode Pembayaran",
        head: ["Metode", "Gross", "Komisi 20%", "Net Store", "Persen"],
        body: payments.map(p => [p.method, fmtIDR(p.amount), fmtIDR(p.commission || 0), fmtIDR(p.netAmount ?? p.amount), p.pct + "%"]),
      }] : []),
      ...(byDay.length > 0 ? [{
        label: "Penjualan per Hari",
        head: ["Tanggal","Trx","Gross","Komisi 20%","Net Store","COGS","Profit","Margin"],
        body: byDay.map(d => {
          const p = d.netRevenue - d.cogs
          return [
            new Date(d.date + "T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short"}),
            d.orders, fmtIDR(d.revenue), fmtIDR(d.commission), fmtIDR(d.netRevenue), fmtIDR(d.cogs),
            fmtIDR(p), (d.netRevenue > 0 ? Math.round(p/d.netRevenue*100) : 0) + "%",
          ]
        }),
      }] : []),
    ]
    exportPDF({ title:"Analisis Penjualan", periodLabel, filterLabel, tables, filename:"pawonloka-analisis-" + slug + ".pdf" })
  }

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate} customDateTo={customDateTo} setCustomDateTo={setCustomDateTo} loading={loading} lastUpdated={lastUpdated} onRefresh={() => loadRef.current()}>
        <MultiItemSelect options={allItemNames} selected={itemFilter} onChange={setItemFilter} />
        <button onClick={handleExportExcel} className="bo-btn bo-btn-ghost bo-btn-sm">↓ Excel</button>
        <button onClick={handleExportPdf}   className="bo-btn bo-btn-ghost bo-btn-sm">↓ PDF</button>
      </DateRangePicker>

      {err && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#DC2626", fontSize:13 }}>⚠ Gagal memuat data: {err}</div>}

      {/* ── P&L Summary ───────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:12, marginBottom:16 }}>
        {[
          { label:"Gross Revenue",         value:fmt(summary.revenue),    color:"var(--ink)",  sub:`${summary.orders} transaksi · avg ${fmt(summary.avg)}` },
          { label:"Komisi Platform (20%)", value:fmt(summary.commission), color:"#D97706",     sub:`Net Store: ${fmt(summary.netRevenue)}` },
          { label:"Est. COGS",             value:fmt(summary.cogs),       color:"#DC2626",     sub:"Estimasi harga pokok" },
          { label:"Net Gross Profit",      value:fmt(summary.profit),     color:summary.profit >= 0 ? "#059669" : "#DC2626", sub:`Margin ${summary.margin}% (setelah komisi)` },
        ].map(k => (
          <div key={k.label} style={{ background:"#fff", borderRadius:14, padding:"20px 22px", border:"1px solid var(--surface3)" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--ink4)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:900, color:k.color, letterSpacing:"-0.5px", marginBottom:4 }}>{k.value}</div>
            <div style={{ fontSize:11, color:"var(--ink5)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="bo-sa-cards" style={{ gap:16, marginBottom:16 }}>

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
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--ink5)", marginTop:3 }}>
                  <span>{p.pct}% dari total penjualan</span>
                  {p.commission > 0 && (
                    <span style={{ color:"#D97706", fontWeight:600 }}>
                      Komisi 20%: {fmt(p.commission)} · Net: {fmt(p.netAmount)}
                    </span>
                  )}
                </div>
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
                      <span style={{ fontSize:13, fontWeight:700, color:r.color, textAlign:"right", lineHeight:1.4 }}>
                        {r.pct}%<br /><span style={{ fontSize:11, fontWeight:600 }}>{fmt(r.value)}</span>
                      </span>
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
                <th style={{ textAlign:"right" }}>Gross Revenue</th>
                <th style={{ textAlign:"right" }}>Komisi 20%</th>
                <th style={{ textAlign:"right" }}>Net Store</th>
                <th style={{ textAlign:"right" }}>COGS</th>
                <th style={{ textAlign:"right" }}>Profit</th>
                <th style={{ textAlign:"right" }}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {byDay.map(d => {
                const profit = d.netRevenue - d.cogs
                const margin = d.netRevenue > 0 ? Math.round(profit / d.netRevenue * 100) : 0
                const dateLabel = new Date(d.date + "T12:00:00").toLocaleDateString("id-ID", { weekday:"short", day:"numeric", month:"short" })
                return (
                  <tr key={d.date}>
                    <td style={{ fontWeight:600 }}>{dateLabel}</td>
                    <td style={{ textAlign:"right" }}>{d.orders}</td>
                    <td style={{ textAlign:"right", fontWeight:700 }}>{fmt(d.revenue)}</td>
                    <td style={{ textAlign:"right", color:"#D97706", fontWeight:600 }}>{d.commission ? fmt(d.commission) : "—"}</td>
                    <td style={{ textAlign:"right", fontWeight:700, color:"#7C3AED" }}>{fmt(d.netRevenue)}</td>
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
