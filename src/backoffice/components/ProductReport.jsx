import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase } from "../../lib/supabase"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"
import MultiItemSelect from "./MultiItemSelect"
import { exportPDF, exportExcel, formatPeriodLabel, filenameSlug, fmtIDR } from "./exportUtils"

const fmt   = n => "Rp " + Number(n||0).toLocaleString("id-ID")
const today = () => new Date().toISOString().slice(0,10)

export default function ProductReport() {
  const [range,       setRange]       = useState("month")
  const [customDate,  setCustomDate]  = useState(today())
  const [customDateTo,setCustomDateTo]= useState(today())
  const [catFilter,   setCatFilter]   = useState("")
  const [itemFilter,  setItemFilter]  = useState(new Set())
  const [sortBy,      setSortBy]      = useState("qty")
  const [rows,        setRows]        = useState([])
  const [cats,        setCats]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [err,         setErr]         = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    supabase.from("categories").select("name").order("sort")
      .then(({ data }) => setCats((data||[]).map(c => c.name)))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const { fromStr, toStr } = buildDateRange(range, customDate, customDateTo)
    let q = supabase.from("orders").select("items").eq("status","Paid").gte("created_at", fromStr)
    if (toStr) q = q.lte("created_at", toStr)
    const { data, error } = await q
    if (error) { setErr(error.message); setLoading(false); return }

    const map = {}
    ;(data||[]).forEach(o => {
      const raw = o.items_snapshot||o.order_items||o.items||[]
      const items = typeof raw === "string" ? JSON.parse(raw) : raw
      ;(items||[]).forEach(i => {
        if (!map[i.name]) map[i.name] = { name:i.name, cat:i.cat||"—", qty:0, revenue:0 }
        map[i.name].qty     += i.qty||1
        map[i.name].revenue += (i.price||0)*(i.qty||1)
      })
    })
    setRows(Object.values(map).map(r => ({ ...r, avgPrice: r.qty ? Math.round(r.revenue/r.qty) : 0 })))
    setLastUpdated(new Date())
    setLoading(false)
  }, [range, customDate, customDateTo])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => { load() }, [load])

  const allItemNames = useMemo(() => rows.map(r => r.name).sort(), [rows])

  const filterLabel = [
    catFilter ? "Kategori: " + catFilter : null,
    itemFilter.size > 0 ? [...itemFilter].join(", ") : null,
  ].filter(Boolean).join(" | ") || null
  const periodLabel = formatPeriodLabel(range, customDate, customDateTo)
  const slug = filenameSlug(range, customDate, customDateTo)

  function handleExportExcel() {
    exportExcel({
      title: "Laporan Produk", periodLabel, filterLabel,
      filename: "pawonloka-produk-" + slug + ".xlsx",
      sheets: [{
        name: "Produk",
        columns: ["#","Produk","Kategori","Qty Terjual","Revenue","Avg Harga"],
        colWidths: [6,28,18,14,20,18],
        rows: filtered.map((r,i) => [i+1, r.name, r.cat, r.qty, fmtIDR(r.revenue), fmtIDR(r.avgPrice)]),
      }],
    })
  }

  function handleExportPdf() {
    exportPDF({
      title: "Laporan Produk", periodLabel, filterLabel,
      filename: "pawonloka-produk-" + slug + ".pdf",
      tables: [{
        head: ["#","Produk","Kategori","Qty","Revenue","Avg"],
        body: filtered.map((r,i) => [i+1, r.name, r.cat, r.qty+"×", fmtIDR(r.revenue), fmtIDR(r.avgPrice)]),
      }],
    })
  }

  const filtered = rows
    .filter(r => (!catFilter || r.cat === catFilter) && (itemFilter.size === 0 || itemFilter.has(r.name)))
    .sort((a,b) => sortBy === "qty" ? b.qty - a.qty : b.revenue - a.revenue)
  const totals = filtered.reduce((s,r) => ({ qty:s.qty+r.qty, revenue:s.revenue+r.revenue }), { qty:0, revenue:0 })

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate}
        customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
        loading={loading} lastUpdated={lastUpdated} onRefresh={() => loadRef.current()}>
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="bo-select" style={{height:34,fontSize:13}}>
          <option value="">Semua Kategori</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="bo-select" style={{height:34,fontSize:13}}>
          <option value="qty">Urut: Qty</option>
          <option value="revenue">Urut: Revenue</option>
        </select>
        <MultiItemSelect options={allItemNames} selected={itemFilter} onChange={setItemFilter} />
        <button onClick={handleExportExcel} className="bo-btn bo-btn-ghost bo-btn-sm">↓ Excel</button>
        <button onClick={handleExportPdf}   className="bo-btn bo-btn-ghost bo-btn-sm">↓ PDF</button>
      </DateRangePicker>

      {err && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#DC2626", fontSize:13 }}>⚠ Gagal memuat data: {err}</div>}

      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading
          ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Memuat...</div>
          : filtered.length === 0
            ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Tidak ada data pada periode ini</div>
            : (
              <table className="bo-table">
                <thead>
                  <tr>
                    <th>#</th><th>Produk</th><th>Kategori</th>
                    <th style={{textAlign:"right"}}>Qty Terjual</th>
                    <th style={{textAlign:"right"}}>Revenue</th>
                    <th style={{textAlign:"right"}}>Avg Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r,i) => (
                    <tr key={r.name}>
                      <td style={{ color:"#6B778C", fontWeight:700 }}>{i+1}</td>
                      <td style={{ fontWeight:600 }}>{r.name}</td>
                      <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:"#F4F5F7", color:"#42526E" }}>{r.cat}</span></td>
                      <td style={{ textAlign:"right", fontWeight:800, color:"#0052CC" }}>{r.qty}×</td>
                      <td style={{ textAlign:"right", fontWeight:800, color:"#00875A" }}>{fmt(r.revenue)}</td>
                      <td style={{ textAlign:"right", color:"#6B778C" }}>{fmt(r.avgPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"#F4F5F7", fontWeight:800 }}>
                    <td colSpan={3}>TOTAL ({filtered.length} produk)</td>
                    <td style={{ textAlign:"right" }}>{totals.qty}×</td>
                    <td style={{ textAlign:"right", color:"#00875A" }}>{fmt(totals.revenue)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            )
        }
      </div>
    </div>
  )
}
