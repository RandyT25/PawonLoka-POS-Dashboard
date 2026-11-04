import React from "react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase } from "../../lib/supabase"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"
import MultiItemSelect from "./MultiItemSelect"
import { exportPDF, exportExcel, formatPeriodLabel, filenameSlug, fmtIDR } from "./exportUtils"
import { explodeOrderPayments, computeOrderCommission } from "../../shared/orderPricing"

const fmt  = n => "Rp " + Number(n||0).toLocaleString("id-ID")
const today = () => new Date().toISOString().slice(0,10)

export default function SalesReport() {
  const [range,       setRange]       = useState("month")
  const [customDate,  setCustomDate]  = useState(today())
  const [customDateTo,setCustomDateTo]= useState(today())
  const [expandedDate, setExpandedDate] = useState(null)
  const [itemFilter,  setItemFilter]  = useState(new Set())
  const [payFilter,   setPayFilter]   = useState("all")
  const [rawOrders,   setRawOrders]   = useState([])
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [err,         setErr]         = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const { fromStr, toStr } = buildDateRange(range, customDate, customDateTo)
    let q = supabase.from("orders").select("id,date,total,subtotal,tax,discount,status,items,pay,payments").eq("status","Paid").gte("created_at", fromStr)
    if (toStr) q = q.lte("created_at", toStr)
    const { data, error } = await q.order("date", { ascending: false })
    if (error) { setErr(error.message); setLoading(false); return }
    setRawOrders(data || [])
    setLastUpdated(new Date())
    setLoading(false)
  }, [range, customDate, customDateTo])

  const allItemNames = useMemo(() => {
    const names = new Set()
    rawOrders.forEach(o => {
      const its = typeof o.items === "string" ? JSON.parse(o.items || "[]") : (o.items || [])
      ;(its || []).forEach(i => { if (i.name) names.add(i.name) })
    })
    return [...names].sort()
  }, [rawOrders])

  useEffect(() => {
    const filtered = rawOrders.filter(o => {
      if (payFilter !== "all") {
        const methods = explodeOrderPayments(o).map(p => p.method)
        if (!methods.includes(payFilter) && o.pay !== payFilter) return false
      }
      if (itemFilter.size === 0) return true
      const its = typeof o.items === "string" ? JSON.parse(o.items || "[]") : (o.items || [])
      return (its || []).some(i => itemFilter.has(i.name))
    })
    const map = {}
    filtered.forEach(o => {
      const d = o.date
      const comm = computeOrderCommission(o)
      if (!map[d]) map[d] = { date:d, orders:0, subtotal:0, tax:0, discount:0, total:0, commission:0, netRevenue:0, orderList: [] }
      map[d].orders++;  map[d].subtotal += o.subtotal||0
      map[d].tax      += o.tax||0;    map[d].discount += o.discount||0
      map[d].total    += o.total||0
      map[d].commission += comm.commission
      map[d].netRevenue += comm.netRevenue
      map[d].orderList.push(o)
    })
    setRows(Object.values(map).sort((a,b) => b.date.localeCompare(a.date)))
  }, [rawOrders, itemFilter, payFilter])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => { load() }, [load])

  const filterLabel = itemFilter.size > 0 ? [...itemFilter].join(", ") : null
  const periodLabel = formatPeriodLabel(range, customDate, customDateTo)
  const slug = filenameSlug(range, customDate, customDateTo)

  const totals = rows.reduce((s,r) => ({
    orders: s.orders+r.orders, subtotal: s.subtotal+r.subtotal,
    tax: s.tax+r.tax, discount: s.discount+r.discount, total: s.total+r.total,
    commission: s.commission+(r.commission||0), netRevenue: s.netRevenue+(r.netRevenue||0),
  }), { orders:0, subtotal:0, tax:0, discount:0, total:0, commission:0, netRevenue:0 })
  const avgTicket = totals.orders ? Math.round(totals.total/totals.orders) : 0

  function handleExportExcel() {
    exportExcel({
      title: "Laporan Penjualan", periodLabel, filterLabel,
      filename: "pawonloka-sales-" + slug + ".xlsx",
      sheets: [{
        name: "Penjualan Harian",
        columns: ["Tanggal","Transaksi","Subtotal","Pajak","Diskon","Komisi Platform (20%)","Net Store","Gross Total","Avg Tiket"],
        colWidths: [22,12,18,16,16,22,20,20,18],
        rows: [
          ...rows.map(r => [
            new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}),
            r.orders, fmtIDR(r.subtotal), fmtIDR(r.tax),
            r.discount ? fmtIDR(r.discount) : "—",
            r.commission ? fmtIDR(r.commission) : "—",
            fmtIDR(r.netRevenue),
            fmtIDR(r.total),
            fmtIDR(r.orders ? Math.round(r.total/r.orders) : 0),
          ]),
          ["TOTAL", totals.orders, fmtIDR(totals.subtotal), fmtIDR(totals.tax),
            totals.discount ? fmtIDR(totals.discount) : "—",
            totals.commission ? fmtIDR(totals.commission) : "—",
            fmtIDR(totals.netRevenue),
            fmtIDR(totals.total), fmtIDR(avgTicket)],
        ],
      }],
    })
  }

  function handleExportPdf() {
    exportPDF({
      title: "Laporan Penjualan", periodLabel, filterLabel,
      filename: "pawonloka-sales-" + slug + ".pdf",
      tables: [{
        head: ["Tanggal","Trx","Subtotal","Diskon","Komisi 20%","Net Store","Gross Total"],
        body: [
          ...rows.map(r => [
            new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short"}),
            r.orders, fmtIDR(r.subtotal),
            r.discount ? fmtIDR(r.discount) : "—",
            r.commission ? fmtIDR(r.commission) : "—",
            fmtIDR(r.netRevenue),
            fmtIDR(r.total),
          ]),
          ["TOTAL", totals.orders, fmtIDR(totals.subtotal),
            totals.discount ? fmtIDR(totals.discount) : "—",
            totals.commission ? fmtIDR(totals.commission) : "—",
            fmtIDR(totals.netRevenue),
            fmtIDR(totals.total)],
        ],
      }],
    })
  }

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate}
        customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
        loading={loading} lastUpdated={lastUpdated} onRefresh={() => loadRef.current()}>
        <select value={payFilter} onChange={e => setPayFilter(e.target.value)} className="bo-select" style={{ width:"auto", minWidth:140, padding:"6px 10px", fontSize:12 }}>
          <option value="all">Semua Pembayaran</option>
          <option value="Cash">💵 Cash</option>
          <option value="QRIS">📲 QRIS</option>
          <option value="Card">💳 Card / Debit</option>
          <option value="GoFood">🚴 GoFood</option>
          <option value="GrabFood">🟢 GrabFood</option>
          <option value="ShopeeFood">🛍️ ShopeeFood</option>
          <option value="Transfer">🏦 Transfer</option>
        </select>
        <MultiItemSelect options={allItemNames} selected={itemFilter} onChange={setItemFilter} />
        <button onClick={handleExportExcel} className="bo-btn bo-btn-ghost bo-btn-sm">↓ Excel</button>
        <button onClick={handleExportPdf}   className="bo-btn bo-btn-ghost bo-btn-sm">↓ PDF</button>
      </DateRangePicker>

      {err && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#DC2626", fontSize:13 }}>⚠ Gagal memuat data: {err}</div>}

      {/* Summary strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10, marginBottom:14 }}>
        {[
          ["Total Transaksi",      totals.orders,          "#0052CC", "transaksi lunas"],
          ["Gross Revenue",        fmt(totals.total),      "#00875A", "termasuk +20% online"],
          ["Komisi Platform (20%)",fmt(totals.commission), "#D97706", "GoFood / GrabFood / ShopeeFood"],
          ["Net Revenue (Store)",  fmt(totals.netRevenue), "#7C3AED", "setelah dipotong komisi"],
          ["Avg per Transaksi",    fmt(avgTicket),         "#FF8B00", "rata-rata tiket"],
          ["Total Diskon",         fmt(totals.discount),   "#DE350B", totals.discount ? "diskon diberikan" : "tidak ada diskon"],
        ].map(([l,v,c,sub]) => (
          <div key={l} style={{ background:"#fff", borderRadius:12, padding:"14px 16px", border:"1px solid #f0f0f0" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#6B778C", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.4px" }}>{l}</div>
            <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:"#94A3B8", marginTop:3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading
          ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Memuat...</div>
          : rows.length === 0
            ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Tidak ada data pada periode ini</div>
            : (
              <table className="bo-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th style={{textAlign:"right"}}>Transaksi</th>
                    <th style={{textAlign:"right"}}>Subtotal</th>
                    <th style={{textAlign:"right"}}>Diskon</th>
                    <th style={{textAlign:"right"}}>Komisi Platform</th>
                    <th style={{textAlign:"right"}}>Net Store</th>
                    <th style={{textAlign:"right"}}>Gross Total</th>
                    <th style={{textAlign:"right"}}>Avg Tiket</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <React.Fragment key={r.date}>
<tr onClick={() => setExpandedDate(expandedDate === r.date ? null : r.date)} style={{ cursor: "pointer", background: expandedDate === r.date ? "var(--surface2)" : undefined }}>
                      <td style={{ fontWeight:600 }}>{new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</td>
                      <td style={{ textAlign:"right" }}>{r.orders}</td>
                      <td style={{ textAlign:"right" }}>{fmt(r.subtotal)}</td>
                      <td style={{ textAlign:"right", color:"#DE350B" }}>{r.discount ? fmt(r.discount) : "—"}</td>
                      <td style={{ textAlign:"right", color:"#D97706", fontWeight:600 }}>{r.commission ? fmt(r.commission) : "—"}</td>
                      <td style={{ textAlign:"right", fontWeight:700, color:"#7C3AED" }}>{fmt(r.netRevenue)}</td>
                      <td style={{ textAlign:"right", fontWeight:800, color:"#00875A" }}>{fmt(r.total)}</td>
                      <td style={{ textAlign:"right", color:"#6B778C" }}>{fmt(r.orders ? Math.round(r.total/r.orders) : 0)}</td>
                    </tr>

                    {expandedDate === r.date && (

                      <tr style={{ background: "var(--surface2)" }}>

                        <td colSpan={8} style={{ padding: "16px 24px" }}>

                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink4)" }}>Orders on {new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>

                          <table className="bo-table" style={{ background: "#fff", border: "1px solid var(--surface3)", borderRadius: "var(--r)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>

                            <thead>

                              <tr>

                                <th>Order ID</th>

                                <th>Pembayaran</th>

                                <th>Items</th>

                                <th style={{ textAlign:"right" }}>Komisi 20%</th>

                                <th style={{ textAlign:"right" }}>Net Store</th>

                                <th style={{ textAlign:"right" }}>Gross Total</th>

                              </tr>

                            </thead>

                            <tbody>

                              {r.orderList.map(o => {
                                const parsedItems = typeof o.items === "string" ? JSON.parse(o.items || "[]") : (o.items || [])
                                const oComm = computeOrderCommission(o)
                                return (
                                <tr key={o.id}>

                                  <td style={{ fontFamily: "monospace" }}>#{String(o.id || "").slice(-6)}</td>

                                  <td><span className="bo-badge bo-badge-blue">{o.pay || "—"}</span></td>

                                  <td style={{ fontSize: 12, color: "var(--ink5)" }}>{(parsedItems || []).map(i => `${i.qty}x ${i.name}`).join(", ")}</td>

                                  <td style={{ textAlign:"right", color:"#D97706", fontWeight:600 }}>{oComm.commission ? fmt(oComm.commission) : "—"}</td>

                                  <td style={{ textAlign:"right", color:"#7C3AED", fontWeight:600 }}>{fmt(oComm.netRevenue)}</td>

                                  <td style={{ textAlign:"right", fontWeight: 700 }}>{fmt(o.total)}</td>

                                </tr>
                              )})}

                            </tbody>

                          </table>

                        </td>

                      </tr>

                    )}

                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"#F4F5F7", fontWeight:800 }}>
                    <td>TOTAL</td>
                    <td style={{ textAlign:"right" }}>{totals.orders}</td>
                    <td style={{ textAlign:"right" }}>{fmt(totals.subtotal)}</td>
                    <td style={{ textAlign:"right", color:"#DE350B" }}>{totals.discount ? fmt(totals.discount) : "—"}</td>
                    <td style={{ textAlign:"right", color:"#D97706" }}>{totals.commission ? fmt(totals.commission) : "—"}</td>
                    <td style={{ textAlign:"right", color:"#7C3AED" }}>{fmt(totals.netRevenue)}</td>
                    <td style={{ textAlign:"right", color:"#00875A" }}>{fmt(totals.total)}</td>
                    <td style={{ textAlign:"right" }}>{fmt(avgTicket)}</td>
                  </tr>
                </tfoot>
              </table>
            )
        }
      </div>
    </div>
  )
}
