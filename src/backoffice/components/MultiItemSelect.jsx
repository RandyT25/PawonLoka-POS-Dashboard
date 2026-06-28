import { useState, useRef, useEffect } from "react"

export default function MultiItemSelect({ options, selected, onChange, placeholder = "Semua Produk" }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef(null)

  useEffect(() => {
    const handle = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  function toggle(name) {
    const s = new Set(selected)
    s.has(name) ? s.delete(name) : s.add(name)
    onChange(s)
  }

  const filtered = options
    .filter(n => !search || n.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 120)

  const hasFilter = selected.size > 0

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button
        onClick={() => { setOpen(o => !o); setSearch("") }}
        className={"bo-btn bo-btn-sm " + (hasFilter ? "bo-btn-primary" : "bo-btn-ghost")}
        style={{ display:"flex", alignItems:"center", gap:5 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
        </svg>
        {hasFilter ? `${selected.size} produk` : placeholder}
        {hasFilter && (
          <span
            onClick={e => { e.stopPropagation(); onChange(new Set()) }}
            style={{ marginLeft:2, opacity:0.7, lineHeight:1 }}>
            ✕
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position:"absolute", zIndex:9999, top:"calc(100% + 4px)", right:0,
          background:"#fff", border:"1.5px solid var(--brand)", borderRadius:8,
          boxShadow:"0 8px 24px rgba(0,0,0,0.12)", minWidth:220, maxWidth:320,
        }}>
          <div style={{ padding:"6px 8px", borderBottom:"1px solid var(--surface3)" }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari produk..." className="bo-input" style={{ margin:0, fontSize:12 }}
              onClick={e => e.stopPropagation()} />
          </div>
          {selected.size > 0 && (
            <div style={{ padding:"4px 10px", borderBottom:"1px solid var(--surface3)", textAlign:"right" }}>
              <button onClick={() => onChange(new Set())}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"var(--ink4)", padding:"2px 0" }}>
                Hapus semua ({selected.size})
              </button>
            </div>
          )}
          <div style={{ maxHeight:240, overflowY:"auto" }}>
            {options.length === 0
              ? <div style={{ padding:"12px 10px", fontSize:12, color:"var(--ink5)", textAlign:"center" }}>Belum ada data</div>
              : filtered.length === 0
              ? <div style={{ padding:"12px 10px", fontSize:12, color:"var(--ink5)", textAlign:"center" }}>Tidak ditemukan</div>
              : filtered.map(name => (
                <label key={name} style={{
                  display:"flex", alignItems:"center", gap:8, padding:"7px 12px",
                  cursor:"pointer", fontSize:13,
                  background:selected.has(name) ? "var(--brand-lt)" : "transparent",
                }}>
                  <input type="checkbox" checked={selected.has(name)} onChange={() => toggle(name)}
                    style={{ accentColor:"var(--brand)", flexShrink:0 }} />
                  <span style={{
                    color:selected.has(name) ? "var(--brand)" : "var(--ink)",
                    fontWeight:selected.has(name) ? 700 : 400,
                  }}>
                    {name}
                  </span>
                </label>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
