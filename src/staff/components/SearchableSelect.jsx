import { useState, useRef, useEffect } from "react"

export default function SearchableSelect({ options, value, onChange, placeholder, labelKey="name", valueKey="id" }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef()

  useEffect(() => {
    const handleClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const selectedOpt = options.find(o => o[valueKey] === value)
  const filtered = options.filter(o => o[labelKey].toLowerCase().includes(search.toLowerCase()))

  return (
    <div ref={ref} style={{ position:"relative", width:"100%" }}>
      <div onClick={() => { setOpen(!open); setSearch("") }}
           style={{ padding:"12px 14px", border:"1px solid #E8ECF0", borderRadius:10, fontSize:15, background:"#f9f9f9", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ color: selectedOpt ? "#111" : "#999", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {selectedOpt ? selectedOpt[labelKey] : placeholder}
        </span>
        <span style={{ fontSize:10, color:"#999" }}>▼</span>
      </div>
      
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:50, background:"#fff", border:"1px solid #E8ECF0", borderRadius:10, marginTop:4, boxShadow:"0 4px 12px rgba(0,0,0,0.1)", maxHeight:300, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:8, borderBottom:"1px solid #E8ECF0" }}>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} autoFocus
                   placeholder="Type to search..."
                   style={{ width:"100%", padding:"8px 12px", border:"1px solid #E8ECF0", borderRadius:6, fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ overflowY:"auto", flex:1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding:"12px", textAlign:"center", color:"#999", fontSize:14 }}>No matches found</div>
            ) : (
              filtered.map(o => (
                <div key={o[valueKey]} onClick={() => { onChange(o[valueKey]); setOpen(false) }}
                     style={{ padding:"12px 16px", fontSize:14, cursor:"pointer", borderBottom:"1px solid #f5f5f5", background: o[valueKey]===value ? "#f0f7ff" : "transparent" }}>
                  {o[labelKey]}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
