import { useState, useEffect, useRef } from "react"

const DAYS_ID   = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"]
const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
const TEAL = "#4DB6AC"
const TEAL_LIGHT = "#E0F2F1"

function fmtDisplay(dateStr) {
  if (!dateStr) return "—"
  const d = new Date(dateStr + "T12:00:00")
  return d.getDate() + " " + MONTHS_ID[d.getMonth()]
}

function CalendarMonth({ year, month, fromDate, toDate, today, onDay }) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const ds = d => d ? `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}` : null

  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ fontWeight:700, fontSize:16, color:"#212121", paddingLeft:4, marginBottom:12 }}>
        {MONTHS_ID[month]} {year}
      </div>
      {/* Day-of-week header */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
        {DAYS_ID.map(d => (
          <div key={d} style={{ textAlign:"center", fontSize:12, color:"#9E9E9E", fontWeight:500, paddingBottom:6 }}>{d}</div>
        ))}
      </div>
      {/* Day cells — 7-col grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
        {cells.map((d, idx) => {
          if (!d) return <div key={"e"+idx} style={{ height:44 }} />
          const s    = ds(d)
          const isFuture = s > today
          const isFrom   = s === fromDate
          const isTo     = s === toDate
          const inRange  = fromDate && toDate && s > fromDate && s < toDate && fromDate !== toDate
          const selected = isFrom || isTo

          // Half-background for range continuity
          let halfBg = "transparent"
          if (fromDate && toDate && fromDate !== toDate) {
            if (isFrom) halfBg = `linear-gradient(to right, transparent 50%, ${TEAL_LIGHT} 50%)`
            else if (isTo) halfBg = `linear-gradient(to right, ${TEAL_LIGHT} 50%, transparent 50%)`
          }

          return (
            <div key={d} onClick={() => !isFuture && onDay(s)}
              style={{ position:"relative", height:44, display:"flex", alignItems:"center", justifyContent:"center",
                       cursor: isFuture ? "default" : "pointer" }}>
              {/* Range stripe background */}
              <div style={{
                position:"absolute", inset:0,
                background: inRange ? TEAL_LIGHT : halfBg,
              }} />
              {/* Day circle */}
              <div style={{
                position:"relative", zIndex:1,
                width:36, height:36, borderRadius:"50%",
                background: selected ? TEAL : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:15, fontWeight: selected ? 700 : 400,
                color: selected ? "#fff" : isFuture ? "#C8C8C8" : "#212121",
              }}>
                {d}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarRangePicker({ initialFrom, initialTo, onSave, onClose }) {
  const today     = new Date().toISOString().slice(0,10)
  const [from,    setFrom]    = useState(initialFrom || "")
  const [to,      setTo]      = useState(initialTo   || "")
  const [picking, setPicking] = useState(!initialFrom ? "from" : "to") // which end we're setting next
  const bodyRef = useRef(null)

  // Build list of months to display — 12 months back through today
  const months = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() })
  }

  // Scroll to current month on open
  useEffect(() => {
    const el = bodyRef.current?.querySelector("#cal-current-month")
    if (el) el.scrollIntoView({ behavior:"instant" })
  }, [])

  function handleDay(ds) {
    if (picking === "from") {
      setFrom(ds)
      setTo("")
      setPicking("to")
    } else {
      if (ds < from) {
        // Clicked before from → becomes new from, old from becomes to
        setTo(from)
        setFrom(ds)
        setPicking("from")
      } else {
        setTo(ds)
        setPicking("from")
      }
    }
  }

  function handleReset() {
    setFrom("")
    setTo("")
    setPicking("from")
  }

  function handleSave() {
    onSave(from || today, to || from || today)
  }

  const displayFrom = from ? fmtDisplay(from) : picking === "from" ? "Pilih tanggal" : "—"
  const displayTo   = to   ? fmtDisplay(to)   : picking === "to"  ? "Pilih tanggal" : "—"

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9000,
      background:"#fff", display:"flex", flexDirection:"column",
    }}>
      {/* ── Header ────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"16px 20px", borderBottom:"1px solid #F0F0F0", flexShrink:0 }}>
        <button onClick={onClose}
          style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#616161",
                   width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center" }}>
          ✕
        </button>
        <span style={{ fontSize:18, fontWeight:700, color:"#212121" }}>Pilih Tanggal</span>
        <div style={{ width:36 }} />
      </div>

      {/* ── From / To display ─────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", padding:"16px 24px", flexShrink:0,
                    borderBottom:"1px solid #F0F0F0" }}>
        <div onClick={() => setPicking("from")} style={{ flex:1, cursor:"pointer" }}>
          <div style={{ fontSize:12, color:"#9E9E9E", marginBottom:2 }}>Dari</div>
          <div style={{ fontSize:20, fontWeight:800,
                        color: picking === "from" ? TEAL : from ? "#212121" : "#BDBDBD" }}>
            {displayFrom}
          </div>
        </div>
        <div style={{ fontSize:18, color:"#9E9E9E", margin:"0 12px", paddingTop:14 }}>—</div>
        <div onClick={() => from && setPicking("to")} style={{ flex:1, textAlign:"right", cursor: from ? "pointer" : "default" }}>
          <div style={{ fontSize:12, color:"#9E9E9E", marginBottom:2, textAlign:"right" }}>Sampai</div>
          <div style={{ fontSize:20, fontWeight:800, textAlign:"right",
                        color: picking === "to" ? TEAL : to ? "#212121" : "#BDBDBD" }}>
            {displayTo}
          </div>
        </div>
      </div>

      {/* ── Picking hint ──────────────────────────────── */}
      <div style={{ padding:"8px 24px 0", flexShrink:0, minHeight:24 }}>
        <span style={{ fontSize:12, color: TEAL, fontWeight:600 }}>
          {picking === "from" ? "Pilih tanggal mulai" : "Pilih tanggal akhir"}
        </span>
      </div>

      {/* ── Scrollable calendar body ──────────────────── */}
      <div ref={bodyRef} style={{ flex:1, overflowY:"auto", padding:"8px 16px 16px" }}>
        {months.map(({ year, month }, idx) => {
          const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
          return (
            <div key={`${year}-${month}`} id={isCurrentMonth ? "cal-current-month" : undefined}>
              <CalendarMonth
                year={year} month={month}
                fromDate={from} toDate={to}
                today={today}
                onDay={handleDay}
              />
            </div>
          )
        })}
      </div>

      {/* ── Footer ────────────────────────────────────── */}
      <div style={{ display:"flex", gap:12, padding:"12px 20px 20px",
                    borderTop:"1px solid #F0F0F0", flexShrink:0,
                    background:"#fff" }}>
        <button onClick={handleReset}
          style={{ flex:1, padding:"14px 0", borderRadius:12, border:"none",
                   background:"none", color: TEAL, fontSize:16, fontWeight:700, cursor:"pointer" }}>
          Reset
        </button>
        <button onClick={handleSave} disabled={!from}
          style={{ flex:2, padding:"14px 0", borderRadius:12, border:"none",
                   background: from ? TEAL : "#E0E0E0",
                   color:"#fff", fontSize:16, fontWeight:700, cursor: from ? "pointer" : "default" }}>
          Simpan
        </button>
      </div>
    </div>
  )
}
