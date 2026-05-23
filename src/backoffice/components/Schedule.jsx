import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
const STATIONS = ["Kasir","Bar","Bakar","Snack","Kitchen"]
const DAY_SHORT = { Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thu",Friday:"Fri",Saturday:"Sat",Sunday:"Sun" }
const STATION_COLORS = { Kasir:"var(--brand)",Bar:"var(--green)",Bakar:"var(--red)",Snack:"var(--amber)",Kitchen:"#6554C0" }

const STAFF_LIST = ["Nita","Aisyah","Mahes","Alin","Yudi","Meldy","Oji","Claudy"]

export default function Schedule() {
  const [days,       setDays]       = useState({})
  const [shiftStart, setShiftStart] = useState("08:00")
  const [shiftEnd,   setShiftEnd]   = useState("17:00")
  const [attendance, setAttendance] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [tab,        setTab]        = useState("schedule") // schedule | attendance
  const [editDay,    setEditDay]    = useState(null)
  const [editForm,   setEditForm]   = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:sched }, { data:att }] = await Promise.all([
      supabase.from("schedules").select("*").eq("id","weekly-template").single(),
      supabase.from("attendance").select("*").order("date",{ascending:false}).limit(100),
    ])
    if (sched) {
      setDays(sched.days||{})
      setShiftStart(sched.shift_start||"08:00")
      setShiftEnd(sched.shift_end||"17:00")
    }
    setAttendance(att||[])
    setLoading(false)
  }

  async function saveSchedule(newDays) {
    setSaving(true)
    await supabase.from("schedules").upsert({
      id:"weekly-template", days:newDays||days,
      shift_start:shiftStart, shift_end:shiftEnd,
      updated_at:new Date().toISOString()
    })
    setSaving(false)
  }

  function openEdit(day) {
    setEditForm(JSON.parse(JSON.stringify(days[day]||{ off:[], Kasir:[], Bar:[], Bakar:[], Snack:[], Kitchen:[] })))
    setEditDay(day)
  }

  function toggleOff(name) {
    setEditForm(f => {
      const off = f.off||[]
      return { ...f, off: off.includes(name) ? off.filter(n=>n!==name) : [...off,name] }
    })
  }

  function toggleStation(station, name) {
    setEditForm(f => {
      const cur = f[station]||[]
      return { ...f, [station]: cur.includes(name) ? cur.filter(n=>n!==name) : [...cur,name] }
    })
  }

  async function saveDay() {
    const newDays = { ...days, [editDay]: editForm }
    setDays(newDays)
    await saveSchedule(newDays)
    setEditDay(null)
  }

  function shareWhatsApp() {
    let txt = "*JADWAL WARUNG*\n\n"
    DAYS.forEach(day => {
      const d = days[day]||{}
      const off = (d.off||[]).join(", ")||"-"
      txt += `*${day.toUpperCase()}*\n`
      txt += `OFF: ${off}\n`
      STATIONS.forEach(s => { txt += `${s}: ${(d[s]||[]).join(", ")||"-"}\n` })
      txt += "\n"
    })
    if (navigator.share) navigator.share({ text:txt })
    else { navigator.clipboard.writeText(txt); alert("Copied to clipboard!") }
  }

  // Today's schedule
  const todayName = DAYS[new Date().getDay()===0?6:new Date().getDay()-1]
  const todaySchedule = days[todayName]||{}

  // Attendance stats for today
  const todayStr = new Date().toISOString().slice(0,10)
  const todayAtt = attendance.filter(a => a.date===todayStr)

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>

  return (
    <div>
      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center" }}>
        {[["schedule","Weekly Schedule"],["attendance","Attendance Log"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={"bo-btn bo-btn-sm "+(tab===t?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ fontSize:12, color:"var(--ink4)" }}>
            Shift: <input type="time" value={shiftStart} onChange={e=>setShiftStart(e.target.value)} onBlur={()=>saveSchedule()}
              style={{ border:"1px solid var(--surface3)", borderRadius:6, padding:"3px 6px", fontSize:12 }} />
            {" → "}
            <input type="time" value={shiftEnd} onChange={e=>setShiftEnd(e.target.value)} onBlur={()=>saveSchedule()}
              style={{ border:"1px solid var(--surface3)", borderRadius:6, padding:"3px 6px", fontSize:12 }} />
          </div>
          <button onClick={shareWhatsApp} className="bo-btn bo-btn-sm" style={{ background:"#25D366", color:"#fff", border:"none" }}>
            Share WhatsApp
          </button>
          {saving && <span style={{ fontSize:11, color:"var(--ink4)" }}>Saving...</span>}
        </div>
      </div>

      {tab==="schedule" && (
        <>
          {/* Today highlight */}
          <div className="bo-card" style={{ marginBottom:16, background:"var(--brand-lt)", border:"1.5px solid var(--brand)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontSize:14, fontWeight:800, color:"var(--brand)" }}>Today — {todayName}</div>
              <div style={{ fontSize:12, color:"var(--ink4)" }}>Shift {shiftStart} – {shiftEnd}</div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {(todaySchedule.off||[]).length>0 && (
                <div style={{ padding:"4px 10px", borderRadius:20, background:"var(--red-lt)", color:"var(--red)", fontSize:12, fontWeight:700 }}>
                  OFF: {(todaySchedule.off||[]).join(", ")}
                </div>
              )}
              {STATIONS.map(s => (todaySchedule[s]||[]).length>0 && (
                <div key={s} style={{ padding:"4px 10px", borderRadius:20, background:STATION_COLORS[s]+"22", color:STATION_COLORS[s], fontSize:12, fontWeight:700 }}>
                  {s}: {(todaySchedule[s]||[]).join(", ")}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:10 }}>
            {DAYS.map(day => {
              const d = days[day]||{}
              const isToday = day===todayName
              return (
                <div key={day} style={{ background:"#fff", border:"1.5px solid "+(isToday?"var(--brand)":"var(--surface3)"), borderRadius:12, overflow:"hidden" }}>
                  <div style={{ padding:"8px 10px", background:isToday?"var(--brand)":"var(--surface)", borderBottom:"1px solid var(--surface3)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:13, fontWeight:800, color:isToday?"#fff":"var(--ink)" }}>{DAY_SHORT[day]}</span>
                    <button onClick={()=>openEdit(day)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:isToday?"rgba(255,255,255,0.8)":"var(--brand)", fontWeight:600 }}>Edit</button>
                  </div>
                  <div style={{ padding:"8px 10px" }}>
                    {(d.off||[]).length>0 && (
                      <div style={{ marginBottom:6 }}>
                        <div style={{ fontSize:9, fontWeight:700, color:"var(--red)", textTransform:"uppercase", marginBottom:2 }}>OFF</div>
                        {(d.off||[]).map(n=><div key={n} style={{ fontSize:11, color:"var(--red)" }}>{n}</div>)}
                      </div>
                    )}
                    {STATIONS.map(s => (d[s]||[]).length>0 && (
                      <div key={s} style={{ marginBottom:4 }}>
                        <div style={{ fontSize:9, fontWeight:700, color:STATION_COLORS[s], textTransform:"uppercase", marginBottom:1 }}>{s}</div>
                        {(d[s]||[]).map(n=><div key={n} style={{ fontSize:11, color:"var(--ink)" }}>{n}</div>)}
                      </div>
                    ))}
                    {STATIONS.every(s=>!(d[s]||[]).length) && !(d.off||[]).length && (
                      <div style={{ fontSize:11, color:"var(--ink5)", textAlign:"center", padding:"8px 0" }}>Empty</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab==="attendance" && (
        <div>
          {/* Today attendance */}
          <div className="bo-card" style={{ marginBottom:16 }}>
            <div className="bo-card-title">Today's Attendance — {todayStr}</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10 }}>
              {STAFF_LIST.filter(n=>!(todaySchedule.off||[]).includes(n)).map(name => {
                const att = todayAtt.find(a=>a.staff_name===name)
                const scheduled = STATIONS.find(s=>(todaySchedule[s]||[]).includes(name))
                return (
                  <div key={name} style={{ padding:"10px 12px", border:"1.5px solid "+(att?"var(--green)":"var(--surface3)"), borderRadius:10, background:att?"var(--green-lt)":"#fff" }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{name}</div>
                    <div style={{ fontSize:10, color:STATION_COLORS[scheduled]||"var(--ink4)", fontWeight:600, marginBottom:4 }}>{scheduled||"—"}</div>
                    {att ? (
                      <>
                        <div style={{ fontSize:11, color:"var(--green)", fontWeight:600 }}>IN {new Date(att.clock_in).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</div>
                        {att.clock_out && <div style={{ fontSize:11, color:"var(--ink4)" }}>OUT {new Date(att.clock_out).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</div>}
                        {att.clock_in_photo && <img src={att.clock_in_photo} style={{ width:"100%", borderRadius:6, marginTop:4 }} />}
                        <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:10,
                          background:att.status==="late"?"var(--red-lt)":"var(--green-lt)",
                          color:att.status==="late"?"var(--red)":"var(--green)" }}>
                          {att.status==="late"?"Late":"On Time"}
                        </span>
                      </>
                    ) : (
                      <div style={{ fontSize:11, color:"var(--ink5)" }}>Not clocked in</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Full attendance log */}
          <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
            <table className="bo-table">
              <thead><tr><th>Date</th><th>Staff</th><th>Station</th><th>Clock In</th><th>Clock Out</th><th>Status</th><th>Photo</th></tr></thead>
              <tbody>
                {attendance.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontSize:12 }}>{a.date}</td>
                    <td style={{ fontWeight:700 }}>{a.staff_name}</td>
                    <td style={{ fontSize:12, color:"var(--ink4)" }}>{a.scheduled_station||"—"}</td>
                    <td style={{ fontSize:12 }}>{a.clock_in?new Date(a.clock_in).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—"}</td>
                    <td style={{ fontSize:12 }}>{a.clock_out?new Date(a.clock_out).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—"}</td>
                    <td><span className={"bo-badge "+(a.status==="late"?"bo-badge-red":a.status==="early"?"bo-badge-amber":"bo-badge-green")}>{a.status}</span></td>
                    <td>{a.clock_in_photo&&<img src={a.clock_in_photo} style={{ width:36,height:36,borderRadius:6,objectFit:"cover" }} />}</td>
                  </tr>
                ))}
                {attendance.length===0&&<tr><td colSpan={7} style={{ textAlign:"center",color:"var(--ink5)",padding:"32px 0" }}>No attendance records yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Day Modal */}
      {editDay && (
        <div className="bo-overlay" onClick={e=>e.target===e.currentTarget&&setEditDay(null)}>
          <div className="bo-modal" style={{ maxWidth:520 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">Edit — {editDay}</div>
              <button className="bo-modal-close" onClick={()=>setEditDay(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              {/* OFF */}
              <div className="bo-form-row">
                <label className="bo-label">Day Off</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {STAFF_LIST.map(name => (
                    <button key={name} onClick={()=>toggleOff(name)}
                      style={{ padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer",
                        border:"1.5px solid "+((editForm.off||[]).includes(name)?"var(--red)":"var(--surface3)"),
                        background:(editForm.off||[]).includes(name)?"var(--red-lt)":"#fff",
                        color:(editForm.off||[]).includes(name)?"var(--red)":"var(--ink4)" }}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stations */}
              {STATIONS.map(station => (
                <div key={station} className="bo-form-row">
                  <label className="bo-label" style={{ color:STATION_COLORS[station] }}>{station}</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {STAFF_LIST.filter(n=>!(editForm.off||[]).includes(n)).map(name => (
                      <button key={name} onClick={()=>toggleStation(station,name)}
                        style={{ padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer",
                          border:"1.5px solid "+((editForm[station]||[]).includes(name)?STATION_COLORS[station]:"var(--surface3)"),
                          background:(editForm[station]||[]).includes(name)?STATION_COLORS[station]+"22":"#fff",
                          color:(editForm[station]||[]).includes(name)?STATION_COLORS[station]:"var(--ink4)" }}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setEditDay(null)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={saveDay} className="bo-btn bo-btn-primary">Save Day</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
