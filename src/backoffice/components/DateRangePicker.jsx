import { useState, useRef } from "react"
import CalendarRangePicker from "./CalendarRangePicker"

// Format a Date's own local Y/M/D — never route a calendar date through
// toISOString(), which converts to UTC and rolls back a day for any timezone
// ahead of UTC (e.g. WIB, UTC+7) whenever the local time is past midnight
// but before the UTC day has turned over.
export function toLocalYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Shift start hour for business days (e.g., 6 = 06:00 AM)
// Transactions before this time are grouped into the previous day's shift.
export const SHIFT_START_HOUR = 6;

export function getBusinessDate(actualDate = new Date()) {
  const d = new Date(actualDate);
  if (d.getHours() < SHIFT_START_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

const todayStr = () => toLocalYMD(getBusinessDate())

const fmtRange = (from, to) => {
  if (!from) return "Tanggal"
  const fmtD = d => new Date(d + "T12:00:00").toLocaleDateString("id-ID", { day:"numeric", month:"short" })
  if (!to || to === from) return fmtD(from)
  return fmtD(from) + " → " + fmtD(to)
}

export default function DateRangePicker({
  range, setRange,
  customDate, setCustomDate,
  customDateTo, setCustomDateTo,
  loading, lastUpdated, onRefresh, children
}) {
  const [showCal, setShowCal] = useState(false)
  // Once ‹/› steps off a quick preset, `range` becomes "custom" — this remembers which
  // preset we're still stepping through (months vary in length, so repeated clicks must
  // keep anchoring to "current month ± dir", not just re-shift by the previous window's
  // day-count, or the window drifts off calendar-month boundaries after the first step).
  const navModeRef = useRef(null)

  function selectQuickRange(v) {
    navModeRef.current = null
    setRange(v)
  }

  function onSave(from, to) {
    navModeRef.current = null
    setCustomDate(from)
    setCustomDateTo?.(to)
    setRange("custom")
    setShowCal(false)
  }

  function navigate(dir) {
    const now = getBusinessDate()
    let fromDate, toDate
    const continuingMonth = range === "custom" && navModeRef.current === "month"

    if (range === "today") {
      const d = getBusinessDate()
      d.setDate(d.getDate() + dir)
      fromDate = toDate = toLocalYMD(d)
      navModeRef.current = null
    } else if (range === "week") {
      const dow = (now.getDay() + 6) % 7
      const weekStart = getBusinessDate()
      weekStart.setDate(now.getDate() - dow + dir * 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      fromDate = toLocalYMD(weekStart)
      toDate = toLocalYMD(weekEnd)
      navModeRef.current = null
    } else if (range === "month" || continuingMonth) {
      // Anchor from the currently-shown month when continuing a month-stepping session,
      // otherwise from today (first step off the "Bulan Ini" preset).
      const base = range === "month" ? now : new Date((customDate || todayStr()) + "T12:00:00")
      const d = new Date(base.getFullYear(), base.getMonth() + dir, 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      fromDate = toLocalYMD(d)
      toDate = toLocalYMD(end)
      navModeRef.current = "month"
    } else {
      const a = new Date((customDate || todayStr()) + "T12:00:00")
      const b = new Date((customDateTo || customDate || todayStr()) + "T12:00:00")
      const spanDays = Math.max(1, Math.round((b - a) / 86400000) + 1)
      a.setDate(a.getDate() + dir * spanDays)
      b.setDate(b.getDate() + dir * spanDays)
      fromDate = toLocalYMD(a)
      toDate = toLocalYMD(b)
      navModeRef.current = null
    }

    setCustomDate(fromDate)
    setCustomDateTo?.(toDate)
    setRange("custom")
  }

  const isCustom = range === "custom"
  const rangeLabel = isCustom ? fmtRange(customDate, customDateTo) : "Tanggal"

  const navBtnStyle = {
    background:"none", border:"1px solid var(--surface3)", borderRadius:6,
    padding:"2px 8px", fontSize:15, cursor:"pointer", color:"var(--ink3)",
    lineHeight:1, fontWeight:700,
  }

  return (
    <>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>

          {/* Prev / Next navigation */}
          <button style={navBtnStyle} onClick={() => navigate(-1)}>‹</button>
          <button style={navBtnStyle} onClick={() => navigate(1)}>›</button>

          {/* Quick range buttons */}
          {[["today","Hari Ini"],["week","Minggu Ini"],["month","Bulan Ini"]].map(([v, l]) => (
            <button key={v} onClick={() => selectQuickRange(v)}
              className={"bo-btn bo-btn-sm " + (range === v ? "bo-btn-primary" : "bo-btn-ghost")}>
              {l}
            </button>
          ))}

          {/* Tanggal button — opens full calendar */}
          <button onClick={() => setShowCal(true)}
            className={"bo-btn bo-btn-sm " + (isCustom ? "bo-btn-primary" : "bo-btn-ghost")}
            style={{ display:"flex", alignItems:"center", gap:5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8"  y1="2" x2="8"  y2="6"/>
              <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
            {rangeLabel}
          </button>

          {/* ✕ clear custom */}
          {isCustom && (
            <button onClick={() => selectQuickRange("today")}
              style={{ background:"none", border:"1px solid var(--surface3)", borderRadius:6,
                       padding:"3px 8px", fontSize:12, cursor:"pointer", color:"var(--ink4)", lineHeight:1 }}>
              ✕
            </button>
          )}

          {/* Right: live indicator + refresh + extra children */}
          <div className="bo-drp-right">
            {loading ? (
              <svg style={{ animation:"spin 0.8s linear infinite", flexShrink:0 }} width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--surface3)" strokeWidth="3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:"#10B981",
                               display:"inline-block", boxShadow:"0 0 0 2px #D1FAE5" }} />
                <span style={{ fontSize:10, color:"var(--ink5)", fontWeight:600 }}>Live</span>
                {lastUpdated && (
                  <span style={{ fontSize:10, color:"var(--ink5)" }}>
                    · {lastUpdated.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                  </span>
                )}
                {onRefresh && (
                  <button onClick={onRefresh} title="Refresh sekarang"
                    style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink4)",
                             fontSize:14, padding:"2px 4px", lineHeight:1, borderRadius:4 }}
                    onMouseEnter={e=>e.target.style.color="var(--brand)"}
                    onMouseLeave={e=>e.target.style.color="var(--ink4)"}>
                    ↺
                  </button>
                )}
              </div>
            )}
            {children}
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>

      {showCal && (
        <CalendarRangePicker
          initialFrom={customDate}
          initialTo={customDateTo}
          onSave={onSave}
          onClose={() => setShowCal(false)}
        />
      )}
    </>
  )
}

export function buildDateRange(range, customDate, customDateTo = null) {
  const logicalNow = getBusinessDate();
  const logicalTodayStr = toLocalYMD(logicalNow);
  
  // Format shift start/end strings
  const sh = String(SHIFT_START_HOUR).padStart(2, "0");
  const eh = String(SHIFT_START_HOUR - 1).padStart(2, "0");
  const startTime = `T${sh}:00:00+08:00`;
  const endTime = `T${eh}:59:59+08:00`;

  if (range === "today") {
    const tmr = new Date(logicalNow);
    tmr.setDate(tmr.getDate() + 1);
    return { fromStr: logicalTodayStr + startTime, toStr: toLocalYMD(tmr) + endTime };
  }
  if (range === "week") {
    const dow = (logicalNow.getDay() + 6) % 7; // Mon = 0
    const d = new Date(logicalNow);
    d.setDate(d.getDate() - dow);
    return { fromStr: toLocalYMD(d) + startTime, toStr: null };
  }
  if (range === "month") {
    const y = logicalNow.getFullYear();
    const m = String(logicalNow.getMonth() + 1).padStart(2, "0");
    return { fromStr: `${y}-${m}-01${startTime}`, toStr: null };
  }
  if (range === "custom" && customDate) {
    const toDate = customDateTo || customDate;
    const toDateObj = new Date(toDate + "T12:00:00");
    toDateObj.setDate(toDateObj.getDate() + 1);
    return { fromStr: customDate + startTime, toStr: toLocalYMD(toDateObj) + endTime };
  }
  
  const tmr = new Date(logicalNow);
  tmr.setDate(tmr.getDate() + 1);
  return { fromStr: logicalTodayStr + startTime, toStr: toLocalYMD(tmr) + endTime };
}

