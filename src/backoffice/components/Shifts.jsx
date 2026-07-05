import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("en-US") }

function parseShiftTime(s) {
  // clock_in is stored as "HH.mm" string, date is "YYYY-MM-DD"
  if (!s.clock_in || !s.date) return null
  const [h, m] = s.clock_in.toString().replace(".", ":").split(":").map(Number)
  if (isNaN(h)) return null
  const d = new Date(s.date)
  d.setHours(h, m||0, 0, 0)
  return d
}

function parseCloseTime(s) {
  if (!s.clock_out || !s.date) return null
  const [h, m] = s.clock_out.toString().replace(".", ":").split(":").map(Number)
  if (isNaN(h)) return null
  const d = new Date(s.date)
  d.setHours(h, m||0, 0, 0)
  return d
}

function duration(s) {
  const open = parseShiftTime(s)
  const close = parseCloseTime(s)
  if (!open || !close || close <= open) return "Open"
  const ms = close - open
  return `${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}m`
}

export default function Shifts() {
  const [shifts,  setShifts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [range,   setRange]   = useState("week")

  useEffect(() => { load() }, [range])

  async function load() {
    setLoading(true)
    const now = new Date(), from = new Date()
    if (range==="today") { from.setHours(0,0,0,0) }
    if (range==="week")  { from.setDate(now.getDate()-7) }
    if (range==="month") { from.setDate(1); from.setHours(0,0,0,0) }
    const fromDate = from.toISOString().slice(0,10)
    const { data } = await supabase.from("shifts").select("*")
      .gte("date", fromDate)
      .order("date", { ascending:false })
      .order("created_at", { ascending:false })
    setShifts(data||[])
    setLoading(false)
  }

  const totalSales  = shifts.reduce((a,s) => a+(s.sales||0), 0)
  const totalOrders = shifts.reduce((a,s) => a+(s.total_orders||0), 0)
  const openShifts  = shifts.filter(s => !s.clock_out || s.clock_out===s.clock_in).length

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["today","Today"],["week","This Week"],["month","This Month"]].map(([v,l])=>(
          <button key={v} onClick={()=>setRange(v)} className={"bo-btn bo-btn-sm "+(range===v?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
        ))}
      </div>

      <div className="bo-metrics" style={{ gridTemplateColumns:"repeat(4,1fr)", marginBottom:16 }}>
        <div className="bo-met blue"><div className="bo-met-label">Total Shifts</div><div className="bo-met-val">{shifts.length}</div></div>
        <div className="bo-met green"><div className="bo-met-label">Total Sales</div><div className="bo-met-val">{fmt(totalSales)}</div></div>
        <div className="bo-met brand"><div className="bo-met-label">Total Orders</div><div className="bo-met-val">{totalOrders}</div></div>
        <div className="bo-met amber"><div className="bo-met-label">Open Shifts</div><div className="bo-met-val">{openShifts}</div></div>
      </div>

      <div className="bo-card" style={{ padding:0, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
          <table className="bo-table">
            <thead>
              <tr><th>Staff</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Duration</th><th>Modal</th><th>Ekspektasi</th><th>Aktual</th><th>Selisih</th><th>Sales</th><th>Status</th></tr>
            </thead>
            <tbody>
              {shifts.map(s => {
                const isOpen = !s.clock_out || s.clock_out===s.clock_in
                const dur = duration(s)
                const hasActual = s.actual_cash !== null && s.actual_cash !== undefined
                const discrepancy = s.cash_discrepancy
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight:700 }}>{s.staff||"—"}</td>
                    <td style={{ fontSize:12 }}>{s.date||"—"}</td>
                    <td style={{ fontSize:12 }}>{s.clock_in||"—"}</td>
                    <td style={{ fontSize:12, color:isOpen?"var(--amber)":"var(--ink4)" }}>{isOpen?"—":s.clock_out}</td>
                    <td style={{ fontSize:12 }}>{dur}</td>
                    <td style={{ fontSize:12 }}>{s.float_open||s.floatOpen?fmt(s.float_open||s.floatOpen):"—"}</td>
                    <td style={{ fontSize:12 }}>{s.float_close||s.floatClose?fmt(s.float_close||s.floatClose):"—"}</td>
                    <td style={{ fontSize:12, fontWeight:hasActual?700:400, color:hasActual?"var(--ink)":"var(--ink5)" }}>{hasActual?fmt(s.actual_cash):"—"}</td>
                    <td style={{ fontSize:12, fontWeight:hasActual?700:400, color: discrepancy==null?"var(--ink5)":discrepancy===0?"var(--green)":discrepancy>0?"var(--green)":"var(--red)" }}>
                      {discrepancy==null?"—":(discrepancy>=0?"+":"")+fmt(discrepancy)}
                    </td>
                    <td style={{ fontWeight:700 }}>{fmt(s.sales||0)}</td>
                    <td><span className={"bo-badge "+(isOpen?"bo-badge-amber":"bo-badge-green")}>{isOpen?"Open":"Closed"}</span></td>
                  </tr>
                )
              })}
              {shifts.length===0 && <tr><td colSpan={11} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>No shifts in this period</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
