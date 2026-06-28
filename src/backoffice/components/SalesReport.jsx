import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase } from "../../lib/supabase"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"
import MultiItemSelect from "./MultiItemSelect"
import { exportPDF, exportExcel, formatPeriodLabel, filenameSlug, fmtIDR } from "./exportUtils"

const fmt  = n => "Rp " + Number(n||0).toLocaleString("id-ID")
const today = () => new Date().toISOString().slice(0,10)

export default function SalesReport() {
  const [range,       setRange]       = useState("month")
  const [customDate,  setCustomDate]  = useState(today())
  const [customDateTo,setCustomDateTo]= useState(today())
  const [itemFilter,  setItemFilter]  = useState(new Set())
  const [rawOrders,   setRawOrders]   = useState([])
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [err,         setErr]         = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const { fromStr, toStr } = buildDateRange(range, customDate, customDateTo)
    let q = supabase.from("orders").select("date,total,subtotal,tax,discount,status,items").eq("status","Paid").gte("created_at", fromStr)
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
    const filtered = itemFilter.size === 0 ? rawOrders : rawOrders.filter(o => {
      const its = typeof o.items === "string" ? JSON.parse(o.items || "[]") : (o.items || [])
      return (its || []).some(i => itemFilter.has(i.name))
    })
    const map = {}
    filtered.forEach(o => {
      const d = o.date
      if (!map[d]) map[d] = { date:d, orders:0, subtotal:0, tax:0, discount:0, total:0 }
      map[d].orders++;  map[d].subtotal += o.subtotal||0
      map[d].tax      += o.tax||0;    map[d].discount += o.discount||0
      map[d].total    += o.total||0
    })
    setRows(Object.values(map).sort((a,b) => b.date.localeCompare(a.date)))
  }, [rawOrders, itemFilter])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => { load() }, [load])

  const filterLabel = itemFilter.size > 0 ? [...itemFilter].join(", ") : null
  const periodLabel = formatPeriodLabel(range, customDate, customDateTo)
  const slug = filenameSlug(range, customDate, customDateTo)

  const totals = rows.reduce((s,r) => ({
    orders: s.orders+r.orders, subtotal: s.subtotal+r.subtotal,
    tax: s.tax+r.tax, discount: s.discount+r.discount, total: s.total+r.total,
  }), { orders:0, subtotal:0, tax:0, discount:0, total:0 })
  const avgTicket = totals.orders ? Math.round(totals.total/totals.orders) : 0

  function handleExportExcel() {
    exportExcel({
      title: "Laporan Penjualan", periodLabel, filterLabel,
      filename: "pawonloka-sales-" + slug + ".xlsx",
      sheets: [{
        name: "Penjualan Harian",
        columns: ["Tanggal","Transaksi","Subtotal","Pajak","Diskon","Total","Avg Tiket"],
        colWidths: [22,14,20,18,18,20,18],
        rows: [
          ...rows.map(r => [
            new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}),
            r.orders, fmtIDR(r.subtotal), fmtIDR(r.tax),
            r.discount ? fmtIDR(r.discount) : "—",
            fmtIDR(r.total),
            fmtIDR(r.orders ? Math.round(r.total/r.orders) : 0),
          ]),
          ["TOTAL", totals.orders, fmtIDR(totals.subtotal), fmtIDR(totals.tax),
            totals.discount ? fmtIDR(totals.discount) : "—",
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
        head: ["Tanggal","Transaksi","Subtotal","Pajak","Diskon","Total","Avg"],
        body: [
          ...rows.map(r => [
            new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short"}),
            r.orders, fmtIDR(r.subtotal), fmtIDR(r.tax),
            r.discount ? fmtIDR(r.discount) : "—",
            fmtIDR(r.total),
            fmtIDR(r.orders ? Math.round(r.total/r.orders) : 0),
          ]),
          ["TOTAL", totals.orders, fmtIDR(totals.subtotal), fmtIDR(totals.tax),
            totals.discount ? fmtIDR(totals.discount) : "—",
            fmtIDR(totals.total), fmtIDR(avgTicket)],
        ],
      }],
    })
  }

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate}
        customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
        loading={loading} lastUpdated={lastUpdated} onRefresh={() => loadRef.current()}>
        <MultiItemSelect options={allItemNames} selected={itemFilter} onChange={setItemFilter} />
        <button onClick={handleExportExcel} className="bo-btn bo-btn-ghost bo-btn-sm">↓ Excel</button>
        <button onClick={handleExportPdf}   className="bo-btn bo-btn-ghost bo-btn-sm">↓ PDF</button>
      </DateRangePicker>

      {err && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#DC2626", fontSize:13 }}>⚠ Gagal memuat data: {err}</div>}

      {/* Summary strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10, marginBottom:14 }}>
        {[
          ["Total Transaksi", totals.orders,       "#0052CC", "transaksi lunas"],
          ["Total Revenue",   fmt(totals.total),   "#00875A", "sudah dibayar"],
          ["Avg per Transaksi",fmt(avgTicket),      "#FF8B00", "rata-rata tiket"],
          ["Total Diskon",    fmt(totals.discount),"#DE350B", totals.discount ? "diskon diberikan" : "tidak ada diskon"],
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
                    <th style={{textAlign:"right"}}>Pajak</th>
                    <th style={{textAlign:"right"}}>Diskon</th>
                    <th style={{textAlign:"right"}}>Total</th>
                    <th style={{textAlign:"right"}}>Avg Tiket</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.date}>
                      <td style={{ fontWeight:600 }}>{new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</td>
                      <td style={{ textAlign:"right" }}>{r.orders}</td>
                      <td style={{ textAlign:"right" }}>{fmt(r.subtotal)}</td>
                      <td style={{ textAlign:"right", color:"#6B778C" }}>{fmt(r.tax)}</td>
                      <td style={{ textAlign:"right", color:"#DE350B" }}>{r.discount ? fmt(r.discount) : "—"}</td>
                      <td style={{ textAlign:"right", fontWeight:800, color:"#00875A" }}>{fmt(r.total)}</td>
                      <td style={{ textAlign:"right", color:"#6B778C" }}>{fmt(r.orders ? Math.round(r.total/r.orders) : 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"#F4F5F7", fontWeight:800 }}>
                    <td>TOTAL</td>
                    <td style={{ textAlign:"right" }}>{totals.orders}</td>
                    <td style={{ textAlign:"right" }}>{fmt(totals.subtotal)}</td>
                    <td style={{ textAlign:"right" }}>{fmt(totals.tax)}</td>
                    <td style={{ textAlign:"right", color:"#DE350B" }}>{totals.discount ? fmt(totals.discount) : "—"}</td>
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
