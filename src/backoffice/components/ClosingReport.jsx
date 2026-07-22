import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { fmt } from "../../shared/constants"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"

const todayStr = () => new Date().toISOString().slice(0, 10)

const CASH_TYPES = {
  expense: { label:"Pengeluaran",       color:"#DC2626" },
  return:  { label:"Kembalian Belanja", color:"#F59E0B" },
  topup:   { label:"Top-up Float",      color:"#10B981" },
}

export default function ClosingReport() {
  const [range,        setRange]        = useState("today")
  const [customDate,   setCustomDate]   = useState(todayStr())
  const [customDateTo, setCustomDateTo] = useState(todayStr())
  const [shifts,      setShifts]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [cashLogs,    setCashLogs]    = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { fromStr, toStr } = buildDateRange(range, customDate, customDateTo)
    let q = supabase.from("shifts").select("*").gte("created_at", fromStr)
    if (toStr) q = q.lte("created_at", toStr)
    const { data } = await q.order("created_at", { ascending:false })
    setShifts(data || [])
    setLastUpdated(new Date())
    setLoading(false)
  }, [range, customDate, customDateTo])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selected) { setCashLogs([]); return }
    const day = selected.date || selected.created_at?.slice(0, 10)
    if (!day) { setCashLogs([]); return }
    supabase.from("cash_logs").select("*").eq("date", day).order("time", { ascending:false })
      .then(({ data }) => setCashLogs(data || []))
  }, [selected])

  const totalFloat  = shifts.reduce((s,sh)=>s+(sh.float_open||sh.float||0),0)
  const totalCash   = shifts.reduce((s,sh)=>s+(sh.cash_sales||sh.total_cash||0),0)
  const totalSales  = shifts.reduce((s,sh)=>s+(sh.sales||sh.total_sales||0),0)
  const totalOrders = shifts.reduce((s,sh)=>s+(sh.total_orders||0),0)

  const logExpense = cashLogs.filter(l=>l.type==="expense").reduce((a,l)=>a+(l.amount||0),0)
  const logReturn  = cashLogs.filter(l=>l.type==="return").reduce((a,l)=>a+(l.amount||0),0)
  const logTopup   = cashLogs.filter(l=>l.type==="topup").reduce((a,l)=>a+(l.amount||0),0)

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate}
        customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
        loading={loading} lastUpdated={lastUpdated} onRefresh={() => loadRef.current()} />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
        {[["Shifts",shifts.length,"#0052CC"],["Total Sales",fmt(totalSales),"#00875A"],["Cash",fmt(totalCash),"#F59E0B"],["Orders",totalOrders,"#6554C0"]].map(([l,v,c])=>(
          <div key={l} style={{ background:"#fff", borderRadius:12, padding:"14px 16px", border:"1px solid #E8ECF0" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--ink4)", marginBottom:4, textTransform:"uppercase" }}>{l}</div>
            <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
          </div>
        ))}
      </div>
      {loading ? <div style={{ padding:32, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
        <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Date","Staff","Float","Cash Sales","Total Sales","Orders","Status"].map(h=>(
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--ink4)", borderBottom:"1px solid #E8ECF0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 && <tr><td colSpan={7} style={{ textAlign:"center", padding:32, color:"var(--ink5)" }}>No shifts found for this period</td></tr>}
              {shifts.map(sh => (
                <tr key={sh.id} onClick={()=>setSelected(selected?.id===sh.id?null:sh)}
                  style={{ borderBottom:"1px solid #F0F4F8", cursor:"pointer", background:selected?.id===sh.id?"#F0F7FF":"" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                  onMouseLeave={e=>e.currentTarget.style.background=selected?.id===sh.id?"#F0F7FF":""}>
                  <td style={{ padding:"10px 14px", fontSize:12 }}>{sh.date||sh.created_at?.slice(0,10)||"—"}</td>
                  <td style={{ padding:"10px 14px", fontWeight:600 }}>{sh.staff||sh.staff_name||"—"}</td>
                  <td style={{ padding:"10px 14px", fontSize:12 }}>{fmt(sh.float_open||sh.float||0)}</td>
                  <td style={{ padding:"10px 14px", fontSize:12, fontWeight:700, color:"#00875A" }}>{fmt(sh.sales||sh.total_sales||0)}</td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700 }}>{fmt(sh.sales||sh.total_sales||0)}</td>
                  <td style={{ padding:"10px 14px", fontSize:12 }}>—</td>
                  <td style={{ padding:"10px 14px" }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10,
                      background:sh.clock_out&&sh.clock_out!=="auto-closed"?"#E3FCEF":sh.clock_out==="auto-closed"?"#F3F4F6":"#FFF0B3",
                      color:sh.clock_out&&sh.clock_out!=="auto-closed"?"#00875A":sh.clock_out==="auto-closed"?"#6B778C":"#FF8B00" }}>
                      {sh.clock_out&&sh.clock_out!=="auto-closed"?"Closed":sh.clock_out==="auto-closed"?"Auto-closed":"Open"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selected && (
            <div style={{ padding:"16px 20px", borderTop:"1px solid #E8ECF0", background:"#F8FAFC" }}>
              <div style={{ fontSize:13, fontWeight:800, marginBottom:10 }}>Shift Detail — {selected.staff||selected.staff_name||"—"}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8 }}>
                {[
                  ["Opened",  selected.created_at ? new Date(selected.created_at).toLocaleString("id-ID") : "—"],
                  ["Closed",  selected.clock_out && selected.clock_out !== "auto-closed" ? selected.clock_out : selected.clock_out === "auto-closed" ? "Auto-closed" : "Still open"],
                  ["Float",   fmt(selected.float_open||selected.float||0)],
                  ["Cash Sales", fmt(selected.cash_sales||selected.total_cash||0)],
                  ["Total",   fmt(selected.sales||selected.total_sales||0)],
                  ["Actual Cash", selected.actual_cash != null ? fmt(selected.actual_cash) : "—"],
                  ["Selisih Kas", selected.cash_discrepancy != null ? fmt(selected.cash_discrepancy) : "—"],
                ].map(([k,v])=>(
                  <div key={k} style={{ fontSize:12 }}>
                    <span style={{ color:"var(--ink4)", fontWeight:600 }}>{k}: </span>
                    <span style={{ fontWeight:700 }}>{v}</span>
                  </div>
                ))}
              </div>
              {selected.notes && <div style={{ marginTop:8, fontSize:12, color:"var(--ink4)" }}>Notes: {selected.notes}</div>}

              <div style={{ marginTop:16, paddingTop:14, borderTop:"1px dashed #E2E8F0" }}>
                <div style={{ fontSize:12, fontWeight:800, marginBottom:10 }}>Kas Operasional — {selected.date||selected.created_at?.slice(0,10)}</div>
                <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
                  <div style={{ padding:"6px 12px", borderRadius:8, background:"#FFF1F2", fontSize:12 }}>
                    <span style={{ color:"#DC2626", fontWeight:700 }}>Pengeluaran: </span>{fmt(logExpense)}
                  </div>
                  <div style={{ padding:"6px 12px", borderRadius:8, background:"#FFFBEB", fontSize:12 }}>
                    <span style={{ color:"#B45309", fontWeight:700 }}>Kembalian: </span>{fmt(logReturn)}
                  </div>
                  <div style={{ padding:"6px 12px", borderRadius:8, background:"#F0FDF4", fontSize:12 }}>
                    <span style={{ color:"#16A34A", fontWeight:700 }}>Top-up: </span>{fmt(logTopup)}
                  </div>
                </div>
                {cashLogs.length === 0 ? (
                  <div style={{ fontSize:12, color:"var(--ink5)" }}>Tidak ada transaksi kas pada tanggal ini</div>
                ) : cashLogs.map(l => {
                  const t = CASH_TYPES[l.type] || CASH_TYPES.expense
                  return (
                    <div key={l.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"6px 0", borderBottom:"1px solid #F1F5F9" }}>
                      <span>{l.time} · {l.staff||"—"} · {l.reason}</span>
                      <span style={{ fontWeight:700, color:t.color }}>
                        {l.type==="expense"?"-":"+"}{fmt(l.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
