import { useRef, useState } from "react"

const todayStr = () => new Date().toISOString().slice(0, 10)

const fmtShort = d => d
  ? new Date(d + "T12:00:00").toLocaleDateString("id-ID", { day:"numeric", month:"short" })
  : ""

/**
 * Shared date range picker.
 * Quick buttons: Hari Ini / Minggu Ini / Bulan Ini
 * Custom: sequential 2-step flow
 *   Step 1 — click "Tanggal" → FROM date picker opens
 *   Step 2 — after FROM selected → TO date picker auto-opens
 *   Done — collapses to "19 Jun → 20 Jun" button with ✕
 *
 * Props:
 *   range, setRange
 *   customDate, setCustomDate        — from date "YYYY-MM-DD"
 *   customDateTo, setCustomDateTo    — to date "YYYY-MM-DD" (optional)
 *   loading, lastUpdated, onRefresh, children
 */
export default function DateRangePicker({
  range, setRange,
  customDate, setCustomDate,
  customDateTo, setCustomDateTo,
  loading, lastUpdated, onRefresh, children
}) {
  const fromRef = useRef(null)
  const toRef   = useRef(null)
  const [step, setStep] = useState(0) // 0=idle, 1=picking-from, 2=picking-to

  function openPicker(ref) {
    const el = ref.current
    if (!el) return
    if (el.showPicker) { try { el.showPicker() } catch { el.click() } } else { el.click() }
  }

  function startSelection() {
    setRange("custom")
    setStep(1)
    setTimeout(() => openPicker(fromRef), 50)
  }

  function onFromPicked(e) {
    const val = e.target.value
    if (!val) return
    setCustomDate(val)
    setCustomDateTo?.(val)  // default to same day until TO is picked
    setStep(2)
    setTimeout(() => openPicker(toRef), 100)
  }

  function onToPicked(e) {
    const val = e.target.value
    if (!val) return
    setCustomDateTo?.(val)
    setStep(0) // done — collapse to label button
  }

  function clearCustom() {
    setRange("today")
    setStep(0)
  }

  const isCustom = range === "custom"
  const fromLabel = customDate ? fmtShort(customDate) : "…"
  const toLabel   = customDateTo && customDateTo !== customDate
    ? fmtShort(customDateTo)
    : customDate ? fmtShort(customDate) : "…"
  const rangeLabel = isCustom ? `${fromLabel} → ${toLabel}` : "Tanggal"

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>

        {/* Quick range buttons */}
        {[["today","Hari Ini"],["week","Minggu Ini"],["month","Bulan Ini"]].map(([v, l]) => (
          <button key={v} onClick={() => { setRange(v); setStep(0) }}
            className={"bo-btn bo-btn-sm " + (range === v ? "bo-btn-primary" : "bo-btn-ghost")}>
            {l}
          </button>
        ))}

        {/* Custom date range — single button that collapses to a label */}
        <div style={{ position:"relative" }}>
          <button
            onClick={isCustom ? undefined : startSelection}
            className={"bo-btn bo-btn-sm " + (isCustom ? "bo-btn-primary" : "bo-btn-ghost")}
            style={{ display:"flex", alignItems:"center", gap:5, cursor: isCustom ? "default" : "pointer" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8"  y1="2" x2="8"  y2="6"/>
              <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
            {rangeLabel}
            {/* Picking indicator */}
            {step === 1 && <span style={{ fontSize:10, opacity:0.7 }}> (pilih dari...)</span>}
            {step === 2 && <span style={{ fontSize:10, opacity:0.7 }}> (pilih sampai...)</span>}
          </button>

          {/* Hidden FROM input — triggered programmatically */}
          <input ref={fromRef} type="date"
            defaultValue={todayStr()} max={todayStr()}
            onChange={onFromPicked}
            style={{ position:"absolute", opacity:0, pointerEvents:"none", width:0, height:0, top:0, left:0 }} />

          {/* Hidden TO input — triggered after FROM is picked */}
          <input ref={toRef} type="date"
            min={customDate || undefined} max={todayStr()}
            defaultValue={customDate || todayStr()}
            onChange={onToPicked}
            style={{ position:"absolute", opacity:0, pointerEvents:"none", width:0, height:0, top:0, left:0 }} />
        </div>

        {/* ✕ clear button when custom range is active */}
        {isCustom && (
          <button onClick={clearCustom}
            style={{ background:"none", border:"1px solid var(--surface3)", borderRadius:6, padding:"3px 8px", fontSize:12, cursor:"pointer", color:"var(--ink4)", lineHeight:1 }}
            title="Hapus range">
            ✕
          </button>
        )}

        {/* Right slot — live indicator + controls */}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          {loading ? (
            <svg style={{ animation:"spin 0.8s linear infinite", flexShrink:0 }} width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--surface3)" strokeWidth="3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#10B981", display:"inline-block", boxShadow:"0 0 0 2px #D1FAE5" }} />
              <span style={{ fontSize:10, color:"var(--ink5)", fontWeight:600 }}>Live</span>
              {lastUpdated && (
                <span style={{ fontSize:10, color:"var(--ink5)" }}>
                  · {lastUpdated.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                </span>
              )}
              {onRefresh && (
                <button onClick={onRefresh} title="Refresh sekarang"
                  style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink4)", fontSize:14, padding:"2px 4px", lineHeight:1, borderRadius:4 }}
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
  )
}

/**
 * Returns { fromStr, toStr } for Supabase queries.
 */
export function buildDateRange(range, customDate, customDateTo = null) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (range === "today") {
    return { fromStr: today + "T00:00:00+08:00", toStr: today + "T23:59:59+08:00" }
  }
  if (range === "week") {
    const d = new Date(); d.setDate(now.getDate() - now.getDay()); d.setHours(0, 0, 0, 0)
    return { fromStr: d.toISOString().slice(0, 10) + "T00:00:00+08:00", toStr: null }
  }
  if (range === "month") {
    return { fromStr: now.toISOString().slice(0, 7) + "-01T00:00:00+08:00", toStr: null }
  }
  if (range === "custom" && customDate) {
    const toDate = customDateTo || customDate
    return { fromStr: customDate + "T00:00:00+08:00", toStr: toDate + "T23:59:59+08:00" }
  }
  return { fromStr: today + "T00:00:00+08:00", toStr: today + "T23:59:59+08:00" }
}
