const fs = require('fs');
const file = 'src/owner/OwnerApp.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Insert helper functions near today()
const helpers = `
const SHIFT_START_HOUR = 6;
function getBusinessDate(actualDate = new Date()) {
  const d = new Date(actualDate);
  if (d.getHours() < SHIFT_START_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}
function toLocalYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return \`\${y}-\${m}-\${day}\`
}
`;
if (!content.includes('SHIFT_START_HOUR = 6')) {
  content = content.replace('function today()', helpers + 'function today()');
}

// 2. Replace DateRangeBar with the updated one
const newDateRangeBar = `
function DateRangeBar({ range, setRange, customDate, setCustomDate, customDateTo, setCustomDateTo, loading, lastUpdated, onRefresh }) {
  const [showCal, setShowCal] = useState(false)
  const navModeRef = useRef(null)

  const fmtD = d => new Date(d+"T12:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"short"})
  const rangeLabel = range==="custom" && customDate
    ? (customDateTo && customDateTo!==customDate ? fmtD(customDate)+" → "+fmtD(customDateTo) : fmtD(customDate))
    : "Tanggal"

  function selectQuickRange(v) {
    navModeRef.current = null
    setRange(v)
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
      const base = range === "month" ? now : new Date((customDate || toLocalYMD(now)) + "T12:00:00")
      const d = new Date(base.getFullYear(), base.getMonth() + dir, 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      fromDate = toLocalYMD(d)
      toDate = toLocalYMD(end)
      navModeRef.current = "month"
    } else {
      const a = new Date((customDate || toLocalYMD(now)) + "T12:00:00")
      const b = new Date((customDateTo || customDate || toLocalYMD(now)) + "T12:00:00")
      const spanDays = Math.max(1, Math.round((b - a) / 86400000) + 1)
      a.setDate(a.getDate() + dir * spanDays)
      b.setDate(b.getDate() + dir * spanDays)
      fromDate = toLocalYMD(a)
      toDate = toLocalYMD(b)
      navModeRef.current = null
    }

    setCustomDate(fromDate)
    if (setCustomDateTo) setCustomDateTo(toDate)
    setRange("custom")
  }

  const navBtnStyle = {
    background:"none", border:"1px solid rgba(255,255,255,0.2)", borderRadius:6,
    padding:"2px 8px", fontSize:15, cursor:"pointer", color:"#94A3B8",
    lineHeight:1, fontWeight:700,
  }

  return (
    <>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
      <div className="ow-range-group">
        <button style={navBtnStyle} onClick={() => navigate(-1)}>‹</button>
        <button style={navBtnStyle} onClick={() => navigate(1)}>›</button>

        {[["today","Hari Ini"],["week","Minggu Ini"],["month","Bulan Ini"]].map(([v,l])=>(
          <button key={v} className={"ow-range-btn"+(range===v?" active":"")} onClick={()=>selectQuickRange(v)}>{l}</button>
        ))}
        <button className={"ow-range-btn ow-range-date"+(range==="custom"?" active":"")}
          onClick={()=>setShowCal(true)} title="Pilih rentang tanggal">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{flexShrink:0}}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {rangeLabel}
        </button>
        {range==="custom" && (
          <button onClick={()=>selectQuickRange("today")}
            style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",color:"#94A3B8"}}>
            ✕
          </button>
        )}
      </div>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
        {loading ? (
          <svg className="ow-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#E2E8F0" strokeWidth="3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#0EA5E9" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        ) : (
          <button onClick={onRefresh} title="Refresh data"
            style={{background:"none",border:"none",cursor:"pointer",color:"#94A3B8",fontSize:14,padding:"2px 4px",lineHeight:1}}>
            ↺
          </button>
        )}
        {lastUpdated && !loading && (
          <span style={{fontSize:10,color:"#94A3B8"}}>
            Update: {lastUpdated.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
          </span>
        )}
        <span style={{fontSize:11,color:"#94A3B8"}}>{new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"})}</span>
      </div>
    </div>
    {showCal && (
      <CalendarRangePicker
        initialFrom={customDate}
        initialTo={customDateTo}
        onSave={(from, to) => { setCustomDate(from); if (setCustomDateTo) setCustomDateTo(to); setRange("custom"); navModeRef.current = null; setShowCal(false) }}
        onClose={() => setShowCal(false)}
      />
    )}
    </>
  )
}
`;

const oldDateRangeBarStart = content.indexOf('function DateRangeBar({');
const oldDateRangeBarEnd = content.indexOf('function ScreenDashboard({');
if (oldDateRangeBarStart > -1 && oldDateRangeBarEnd > -1) {
  content = content.substring(0, oldDateRangeBarStart) + newDateRangeBar + '\n' + content.substring(oldDateRangeBarEnd);
} else {
  console.log("Could not find DateRangeBar");
}

// 3. Replace data fetching date logic
const oldFetchDateLogic = `
    let fromStr="", toStr=""
    if (range==="custom") {
      fromStr=customDate+"T00:00:00+08:00"
      toStr=(customDateTo||customDate)+"T23:59:59+08:00"
    } else {
      const now=new Date(), from=new Date()
      if (range==="today") { from.setHours(0,0,0,0) }
      if (range==="week")  { from.setDate(now.getDate()-now.getDay()); from.setHours(0,0,0,0) }
      if (range==="month") { from.setDate(1); from.setHours(0,0,0,0) }
      fromStr=from.getFullYear()+"-"+String(from.getMonth()+1).padStart(2,"0")+"-"+String(from.getDate()).padStart(2,"0")+"T00:00:00+08:00"
    }
`.trim();

const newFetchDateLogic = `
    let fromStr="", toStr=""
    const logicalNow = getBusinessDate();
    const logicalTodayStr = toLocalYMD(logicalNow);
    const sh = String(SHIFT_START_HOUR).padStart(2, "0");
    const eh = String(SHIFT_START_HOUR - 1).padStart(2, "0");
    const startTime = \`T\${sh}:00:00+08:00\`;
    const endTime = \`T\${eh}:59:59+08:00\`;

    if (range==="custom") {
      const toDate = customDateTo || customDate;
      const toDateObj = new Date(toDate + "T12:00:00");
      toDateObj.setDate(toDateObj.getDate() + 1);
      fromStr = customDate + startTime;
      toStr = toLocalYMD(toDateObj) + endTime;
    } else {
      if (range==="today") {
        const tmr = new Date(logicalNow);
        tmr.setDate(tmr.getDate() + 1);
        fromStr = logicalTodayStr + startTime;
        toStr = toLocalYMD(tmr) + endTime;
      } else if (range==="week") {
        const dow = (logicalNow.getDay() + 6) % 7;
        const d = new Date(logicalNow);
        d.setDate(d.getDate() - dow);
        fromStr = toLocalYMD(d) + startTime;
      } else if (range==="month") {
        const y = logicalNow.getFullYear();
        const m = String(logicalNow.getMonth() + 1).padStart(2, "0");
        fromStr = \`\${y}-\${m}-01\${startTime}\`;
      }
    }
`.trim();

if (content.includes(oldFetchDateLogic)) {
  content = content.replace(oldFetchDateLogic, newFetchDateLogic);
} else {
  console.log("Could not find oldFetchDateLogic");
}

// Add useRef import if missing
if (!content.includes('useRef')) {
  content = content.replace('import { useState, useEffect, useMemo } from "react"', 'import { useState, useEffect, useMemo, useRef } from "react"');
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done patching OwnerApp.jsx");
