import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import * as XLSX from "xlsx"

function pad(n) { return String(n).padStart(2,"0") }
function fmtTime(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  return pad(d.getHours())+":"+pad(d.getMinutes())
}
function fmtDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"})
}
function hoursWorked(inIso, outIso) {
  if (!inIso || !outIso) return "—"
  const diff = new Date(outIso) - new Date(inIso)
  if (diff <= 0) return "—"
  const h = Math.floor(diff/3600000)
  const m = Math.floor((diff%3600000)/60000)
  const s = Math.floor((diff%60000)/1000)
  return h+" Jam "+m+" Menit "+s+" Detik"
}
function todayStr() { return new Date().toISOString().slice(0,10) }
function monthStart() { return new Date().toISOString().slice(0,7)+"-01" }

export default function Attendance() {
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [dateFrom,  setDateFrom]  = useState(monthStart)
  const [dateTo,    setDateTo]    = useState(todayStr)
  const [search,    setSearch]    = useState("")
  const [photo,     setPhoto]     = useState(null) // { url, name }

  useEffect(() => { load() }, [dateFrom, dateTo])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending:false })
      .order("clock_in", { ascending:false })
    setRecords(data||[])
    setLoading(false)
  }

  const filtered = records.filter(r =>
    !search || r.staff_name?.toLowerCase().includes(search.toLowerCase())
  )

  // Group by date
  const byDate = {}
  filtered.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  })

  function exportExcel() {
    const rows = filtered.map(r => ({
      "Tanggal":       r.date,
      "Nama":          r.staff_name||"—",
      "Station":       r.scheduled_station||"—",
      "Absen Masuk":   fmtTime(r.clock_in),
      "Absen Keluar":  fmtTime(r.clock_out),
      "Total Jam":     hoursWorked(r.clock_in, r.clock_out),
      "Status":        r.status||"—",
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Absensi")
    XLSX.writeFile(wb, "Absensi_"+dateFrom+"_"+dateTo+".xlsx")
  }

  const totalStaff   = new Set(filtered.map(r=>r.staff_name)).size
  const totalOnTime  = filtered.filter(r=>r.status==="on_time").length
  const totalLate    = filtered.filter(r=>r.status==="late").length
  const totalMissing = filtered.filter(r=>r.clock_in&&!r.clock_out).length

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:22, fontWeight:900, color:"var(--ink1)", marginBottom:4 }}>Attendance</div>
        <div style={{ fontSize:13, color:"var(--ink4)" }}>Staff clock in/out records with selfie verification</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          ["Staff",        totalStaff,   "#0052CC"],
          ["On Time",      totalOnTime,  "#00875A"],
          ["Late",         totalLate,    "#DE350B"],
          ["Missing Out",  totalMissing, "#FF8B00"],
        ].map(([l,v,c])=>(
          <div key={l} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:"1px solid #E8ECF0" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--ink4)", marginBottom:4, textTransform:"uppercase" }}>{l}</div>
            <div style={{ fontSize:24, fontWeight:900, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", padding:"14px 16px", marginBottom:16, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="bo-input" style={{ width:150 }} />
        <span style={{ fontSize:13, color:"var(--ink4)" }}>to</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="bo-input" style={{ width:150 }} />
        <div style={{ display:"flex", gap:6 }}>
          {[["Today",todayStr(),todayStr()],["This Week",new Date(Date.now()-new Date().getDay()*86400000).toISOString().slice(0,10),todayStr()],["This Month",monthStart(),todayStr()]].map(([l,f,t])=>(
            <button key={l} onClick={()=>{setDateFrom(f);setDateTo(t)}} className="bo-btn bo-btn-ghost" style={{ padding:"6px 12px", fontSize:12 }}>{l}</button>
          ))}
        </div>
        <input placeholder="Search staff..." value={search} onChange={e=>setSearch(e.target.value)} className="bo-input" style={{ flex:1, minWidth:160 }} />
        <button onClick={load} className="bo-btn bo-btn-ghost">Refresh</button>
        <button onClick={exportExcel} disabled={filtered.length===0} className="bo-btn bo-btn-ghost" style={{ color:"#00875A", borderColor:"#00875A" }}>Export Excel</button>
      </div>

      {/* Records by date */}
      {loading ? (
        <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>No attendance records found</div>
      ) : (
        Object.entries(byDate).map(([date, recs]) => (
          <div key={date} style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:800, color:"var(--ink4)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8, padding:"0 4px" }}>
              {new Date(date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}
            </div>
            <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#F8FAFC" }}>
                    {["Staff","Station","Absen Masuk","Absen Keluar","Total Jam","Status"].map(h=>(
                      <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--ink4)", borderBottom:"1px solid #E8ECF0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recs.map(r => (
                    <tr key={r.id} style={{ borderBottom:"1px solid #F0F4F8" }}>
                      <td style={{ padding:"10px 14px", fontWeight:700 }}>{r.staff_name||"—"}</td>
                      <td style={{ padding:"10px 14px", fontSize:12, color:"var(--ink4)" }}>{r.scheduled_station||"—"}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          {r.clock_in_photo && (
                            <img src={r.clock_in_photo} onClick={()=>setPhoto({url:r.clock_in_photo,name:r.staff_name+" (In)"})}
                              style={{ width:32, height:32, borderRadius:6, objectFit:"cover", cursor:"pointer", border:"1px solid #E8ECF0" }} />
                          )}
                          <div>
                            <div style={{ fontSize:13, fontWeight:700 }}>{fmtTime(r.clock_in)}</div>
                            <div style={{ fontSize:10, color:"var(--ink5)" }}>{fmtDate(r.clock_in)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:"10px 14px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          {r.clock_out_photo && (
                            <img src={r.clock_out_photo} onClick={()=>setPhoto({url:r.clock_out_photo,name:r.staff_name+" (Out)"})}
                              style={{ width:32, height:32, borderRadius:6, objectFit:"cover", cursor:"pointer", border:"1px solid #E8ECF0" }} />
                          )}
                          <div>
                            <div style={{ fontSize:13, fontWeight:r.clock_out?700:400, color:r.clock_out?"var(--ink)":"var(--ink5)" }}>{fmtTime(r.clock_out)||"—"}</div>
                            {r.clock_out && <div style={{ fontSize:10, color:"var(--ink5)" }}>{fmtDate(r.clock_out)}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:"10px 14px", fontSize:12, color:"var(--ink4)" }}>{hoursWorked(r.clock_in, r.clock_out)}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20,
                          background:r.status==="late"?"#FFEBE6":r.status==="on_time"?"#E3FCEF":"#F4F5F7",
                          color:r.status==="late"?"#DE350B":r.status==="on_time"?"#00875A":"var(--ink4)" }}>
                          {r.status==="late"?"Late":r.status==="on_time"?"On Time":r.clock_in?"No Out":"Absent"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Photo lightbox */}
      {photo && (
        <div onClick={()=>setPhoto(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
          <img src={photo.url} style={{ maxWidth:"90vw", maxHeight:"80vh", borderRadius:12, objectFit:"contain" }} />
          <div style={{ color:"#fff", fontSize:14, fontWeight:700 }}>{photo.name}</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12 }}>Tap to close</div>
        </div>
      )}
    </div>
  )
}
