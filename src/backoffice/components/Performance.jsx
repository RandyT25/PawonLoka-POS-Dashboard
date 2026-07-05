import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("en-US") }

export default function Performance() {
  const [data,    setData]    = useState([])
  const [att,     setAtt]     = useState([])
  const [loading, setLoading] = useState(true)
  const [range,   setRange]   = useState("month")

  useEffect(() => { load() }, [range])

  async function load() {
    setLoading(true)
    const now = new Date(), from = new Date()
    if (range==="today") { from.setHours(0,0,0,0) }
    if (range==="week")  { from.setDate(now.getDate()-7) }
    if (range==="month") { from.setDate(1); from.setHours(0,0,0,0) }
    const fromDate = from.toISOString().slice(0,10)

    const [{ data:orders }, { data:staffData }, { data:attData }] = await Promise.all([
      supabase.from("orders").select("*").eq("status","Paid").gte("created_at",from.toISOString()),
      supabase.from("staff").select("*").order("name"),
      supabase.from("attendance").select("*").gte("date",fromDate),
    ])

    // Build performance map from orders
    const map = {}
    ;(staffData||[]).forEach(s => {
      map[s.name] = { name:s.name, role:s.role||"—", color:s.color||"var(--brand)", orders:0, sales:0, shifts:0, hours:0, lateCount:0 }
    })
    ;(orders||[]).forEach(o => {
      const k = o.staff||"Unknown"
      if (!map[k]) map[k] = { name:k, role:"—", color:"var(--ink4)", orders:0, sales:0, shifts:0, hours:0, lateCount:0 }
      map[k].orders++; map[k].sales += o.total||0
    })

    // Add attendance data
    ;(attData||[]).forEach(a => {
      const k = a.staff_name
      if (!map[k]) return
      map[k].shifts++
      if (a.clock_in && a.clock_out) {
        const ms = new Date(a.clock_out) - new Date(a.clock_in)
        if (ms > 0) map[k].hours += ms / 3600000
      }
      if (a.status==="late") map[k].lateCount++
    })

    const arr = Object.values(map)
      .map(s => ({ ...s, avg:s.orders?Math.round(s.sales/s.orders):0, hoursStr:`${Math.round(s.hours)}h` }))
      .sort((a,b) => b.sales-a.sales)

    setData(arr)
    setAtt(attData||[])
    setLoading(false)
  }

  const maxSales = data[0]?.sales || 1
  const medals = [
    { emoji:"🥇", border:"#FFB800", bg:"#FFFBF0" },
    { emoji:"🥈", border:"#8C9BAB", bg:"#F7F8F9" },
    { emoji:"🥉", border:"#CD7F32", bg:"#FDF6F0" },
  ]

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["today","Today"],["week","This Week"],["month","This Month"]].map(([v,l])=>(
          <button key={v} onClick={()=>setRange(v)} className={"bo-btn bo-btn-sm "+(range===v?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
        ))}
      </div>

      {/* Podium */}
      {data.length > 0 && (
        <div style={{ display:"flex", gap:12, marginBottom:20, overflowX:"auto", WebkitOverflowScrolling:"touch", paddingBottom:4 }}>
          {data.slice(0,3).map((s,i) => (
            <div key={s.name} style={{ textAlign:"center", padding:"16px 20px", background:"#fff", borderRadius:16, border:"2px solid "+medals[i].border, minWidth:140, background:medals[i].bg }}>
              <div style={{ fontSize:32, marginBottom:4 }}>{medals[i].emoji}</div>
              <div style={{ width:40, height:40, borderRadius:"50%", background:s.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff", margin:"0 auto 8px" }}>{s.name.slice(0,2).toUpperCase()}</div>
              <div style={{ fontSize:13, fontWeight:800 }}>{s.name}</div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--brand)" }}>{fmt(s.sales)}</div>
              <div style={{ fontSize:11, color:"var(--ink4)" }}>{s.orders} orders</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bo-card" style={{ padding:0, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
          <table className="bo-table">
            <thead><tr><th>Employee</th><th>Role</th><th>Shifts</th><th>Hours</th><th>Orders</th><th>Total Sales</th><th>Avg/Order</th><th>Late</th><th>Performance</th></tr></thead>
            <tbody>
              {data.map((s,i) => (
                <tr key={s.name}>
                  <td>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:32,height:32,borderRadius:"50%",background:s.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0 }}>{s.name.slice(0,2).toUpperCase()}</div>
                      <span style={{ fontWeight:700 }}>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize:12, color:"var(--ink4)" }}>{s.role}</td>
                  <td>{s.shifts}</td>
                  <td>{s.hoursStr}</td>
                  <td style={{ fontWeight:700 }}>{s.orders}</td>
                  <td style={{ fontWeight:700, color:"var(--brand)" }}>{fmt(s.sales)}</td>
                  <td>{s.orders>0?fmt(s.avg):"—"}</td>
                  <td>
                    {s.lateCount>0
                      ? <span className="bo-badge bo-badge-red">{s.lateCount}</span>
                      : <span className="bo-badge bo-badge-green">Clean</span>}
                  </td>
                  <td>
                    <div style={{ width:100, height:6, background:"var(--surface2)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:6, borderRadius:3, background:"var(--brand)", width:`${Math.min(100,(s.sales/maxSales)*100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {data.length===0 && <tr><td colSpan={9} style={{ textAlign:"center",color:"var(--ink5)",padding:"32px 0" }}>No data for this period</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
