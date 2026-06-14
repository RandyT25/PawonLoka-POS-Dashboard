import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { fmt } from "../../shared/constants"

export default function ClosingReport({ period }) {
  const [shifts,  setShifts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    const from = period + "-01T00:00:00+08:00"
    const d    = new Date(period + "-01")
    d.setMonth(d.getMonth()+1)
    const to   = d.toISOString().slice(0,7) + "-01T00:00:00+08:00"
    const { data: shiftsData } = await supabase
      .from("shifts").select("*").gte("created_at", from).lt("created_at", to).order("created_at", { ascending:false })
    setShifts(shiftsData||[])
    setLoading(false)
  }

  const totalFloat   = shifts.reduce((s,sh)=>s+(sh.float||0),0)
  const totalCash    = shifts.reduce((s,sh)=>s+(sh.cash_sales||sh.total_cash||0),0)
  const totalSales   = shifts.reduce((s,sh)=>s+(sh.total_sales||0),0)
  const totalOrders  = shifts.reduce((s,sh)=>s+(sh.total_orders||0),0)

  return (
    <div>
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
                  ["QRIS",    fmt(selected.qris_sales||0)],
                  ["Other",   fmt(selected.other_sales||0)],
                  ["Total",   fmt(selected.total_sales||0)],
                  ["Orders",  selected.total_orders||0],
                  ["Cash In", fmt(selected.cash_in||0)],
                  ["Cash Out",fmt(selected.cash_out||0)],
                ].map(([k,v])=>(
                  <div key={k} style={{ fontSize:12 }}>
                    <span style={{ color:"var(--ink4)", fontWeight:600 }}>{k}: </span>
                    <span style={{ fontWeight:700 }}>{v}</span>
                  </div>
                ))}
              </div>
              {selected.notes && <div style={{ marginTop:8, fontSize:12, color:"var(--ink4)" }}>Notes: {selected.notes}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
