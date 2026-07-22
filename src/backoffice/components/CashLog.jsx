import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../../lib/supabase"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"
import { exportPDF, exportExcel, formatPeriodLabel, filenameSlug, fmtIDR } from "./exportUtils"

const fmt   = n => "Rp " + Number(n||0).toLocaleString("en-US")
const today = () => new Date().toISOString().slice(0,10)

const TYPES = {
  expense: { label:"Pengeluaran",       icon:"💸", color:"#DC2626" },
  return:  { label:"Kembalian Belanja", icon:"↩️", color:"#F59E0B" },
  topup:   { label:"Top-up Float",      icon:"💰", color:"#10B981" },
}

export default function CashLog() {
  const [range,        setRange]        = useState("today")
  const [customDate,   setCustomDate]   = useState(today())
  const [customDateTo, setCustomDateTo] = useState(today())
  const [staffFilter,  setStaffFilter]  = useState("")
  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(false)
  const [err,          setErr]          = useState(null)
  const [lastUpdated,  setLastUpdated]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const { fromStr, toStr } = buildDateRange(range, customDate, customDateTo)
    const fromDate = fromStr.slice(0, 10)
    const toDate   = (toStr || fromStr).slice(0, 10)
    const { data, error } = await supabase.from("cash_logs").select("*")
      .gte("date", fromDate).lte("date", toDate)
      .order("date", { ascending:false }).order("time", { ascending:false })
    if (error) { setErr(error.message); setLoading(false); return }
    setRows(data || [])
    setLastUpdated(new Date())
    setLoading(false)
  }, [range, customDate, customDateTo])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => { load() }, [load])

  const staffList = [...new Set(rows.map(r => r.staff).filter(Boolean))].sort()
  const filtered  = rows.filter(r => !staffFilter || r.staff === staffFilter)

  const totals = filtered.reduce((s, r) => {
    if (r.type === "expense") s.expense += r.amount || 0
    else if (r.type === "return") s.return += r.amount || 0
    else if (r.type === "topup") s.topup += r.amount || 0
    return s
  }, { expense:0, return:0, topup:0 })
  const net = totals.topup - totals.expense + totals.return

  const periodLabel = formatPeriodLabel(range, customDate, customDateTo)
  const filterLabel = staffFilter ? "Staff: " + staffFilter : null
  const slug = filenameSlug(range, customDate, customDateTo)

  function handleExportExcel() {
    exportExcel({
      title: "Kas Cashier", periodLabel, filterLabel,
      filename: "pawonloka-kas-cashier-" + slug + ".xlsx",
      sheets: [{
        name: "Kas",
        columns: ["Tanggal","Waktu","Staff","Tipe","Keterangan","Jumlah"],
        colWidths: [14,10,16,18,32,16],
        rows: filtered.map(r => [r.date, r.time, r.staff, TYPES[r.type]?.label || r.type, r.reason, fmtIDR(r.amount)]),
      }],
    })
  }

  function handleExportPdf() {
    exportPDF({
      title: "Kas Cashier", periodLabel, filterLabel,
      filename: "pawonloka-kas-cashier-" + slug + ".pdf",
      tables: [{
        head: ["Tanggal","Waktu","Staff","Tipe","Keterangan","Jumlah"],
        body: filtered.map(r => [r.date, r.time, r.staff, TYPES[r.type]?.label || r.type, r.reason, fmtIDR(r.amount)]),
      }],
    })
  }

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate}
        customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
        loading={loading} lastUpdated={lastUpdated} onRefresh={() => loadRef.current()}>
        <select value={staffFilter} onChange={e=>setStaffFilter(e.target.value)} className="bo-select" style={{height:34,fontSize:13}}>
          <option value="">Semua Staff</option>
          {staffList.map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={handleExportExcel} className="bo-btn bo-btn-ghost bo-btn-sm">↓ Excel</button>
        <button onClick={handleExportPdf}   className="bo-btn bo-btn-ghost bo-btn-sm">↓ PDF</button>
      </DateRangePicker>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
        <div style={{ background:"#FFF1F2", border:"1px solid #FECDD3", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#DC2626", marginBottom:4, textTransform:"uppercase" }}>Pengeluaran</div>
          <div style={{ fontSize:20, fontWeight:900, color:"#DC2626" }}>{fmt(totals.expense)}</div>
        </div>
        <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#B45309", marginBottom:4, textTransform:"uppercase" }}>Kembalian</div>
          <div style={{ fontSize:20, fontWeight:900, color:"#B45309" }}>{fmt(totals.return)}</div>
        </div>
        <div style={{ background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#16A34A", marginBottom:4, textTransform:"uppercase" }}>Top-up</div>
          <div style={{ fontSize:20, fontWeight:900, color:"#16A34A" }}>{fmt(totals.topup)}</div>
        </div>
        <div style={{ background: net>=0 ? "#EEF2FF" : "#FFF1F2", border:"1px solid " + (net>=0?"#C7D2FE":"#FECDD3"), borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color: net>=0?"#4338CA":"#DC2626", marginBottom:4, textTransform:"uppercase" }}>Net Kas</div>
          <div style={{ fontSize:20, fontWeight:900, color: net>=0?"#4338CA":"#DC2626" }}>{fmt(net)}</div>
        </div>
      </div>

      {err && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#DC2626", fontSize:13 }}>⚠ Gagal memuat data: {err}</div>}

      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading
          ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Memuat...</div>
          : filtered.length === 0
            ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Tidak ada transaksi kas pada periode ini</div>
            : (
              <table className="bo-table">
                <thead>
                  <tr>
                    <th>Tanggal</th><th>Waktu</th><th>Staff</th><th>Tipe</th><th>Keterangan</th>
                    <th style={{textAlign:"right"}}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const t = TYPES[r.type] || TYPES.expense
                    return (
                      <tr key={r.id}>
                        <td style={{ fontSize:12 }}>{r.date}</td>
                        <td style={{ fontSize:12 }}>{r.time}</td>
                        <td style={{ fontWeight:600 }}>{r.staff || "—"}</td>
                        <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:"#F4F5F7", color:t.color }}>{t.icon} {t.label}</span></td>
                        <td style={{ fontSize:13 }}>{r.reason}</td>
                        <td style={{ textAlign:"right", fontWeight:800, color:t.color }}>
                          {r.type === "expense" ? "-" : "+"}{fmt(r.amount)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
        }
      </div>
    </div>
  )
}
