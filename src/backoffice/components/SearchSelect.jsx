import { useState, useRef, useEffect } from "react"

export default function SearchSelect({ options, value, onChange, placeholder="— Search —", labelKey="name", valueKey="id", renderOption }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef(null)

  const selected = options.find(o => o[valueKey] === value)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const filtered = options.filter(o =>
    !search || o[labelKey]?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 80)

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <div
        onClick={() => { setOpen(o => !o); setSearch("") }}
        className="bo-input"
        style={{ cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", userSelect:"none", padding:"7px 10px" }}
      >
        <span style={{ color: selected ? "var(--ink)" : "var(--ink5)", fontSize:13 }}>
          {selected ? selected[labelKey] : placeholder}
        </span>
        <span style={{ color:"var(--ink5)", fontSize:10 }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ position:"absolute", zIndex:9999, top:"100%", left:0, right:0, background:"#fff", border:"1.5px solid var(--brand)", borderRadius:"var(--r)", boxShadow:"0 8px 24px rgba(0,0,0,0.12)", marginTop:2 }}>
          <div style={{ padding:"6px 8px", borderBottom:"1px solid var(--surface3)" }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="bo-input"
              style={{ margin:0, fontSize:12 }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight:220, overflowY:"auto" }}>
            {filtered.length === 0
              ? <div style={{ padding:"12px 10px", fontSize:12, color:"var(--ink5)", textAlign:"center" }}>No results</div>
              : filtered.map(o => (
                <div
                  key={o[valueKey]}
                  onClick={() => { onChange(o[valueKey]); setOpen(false); setSearch("") }}
                  style={{
                    padding:"8px 12px", fontSize:13, cursor:"pointer",
                    background: o[valueKey]===value ? "var(--brand-lt)" : "transparent",
                    color: o[valueKey]===value ? "var(--brand)" : "var(--ink)",
                    fontWeight: o[valueKey]===value ? 700 : 400,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = o[valueKey]===value ? "var(--brand-lt)" : "var(--surface)"}
                  onMouseLeave={e => e.currentTarget.style.background = o[valueKey]===value ? "var(--brand-lt)" : "transparent"}
                >
                  {renderOption ? renderOption(o) : o[labelKey]}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
