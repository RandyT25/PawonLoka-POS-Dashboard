import { useState, useEffect } from "react"

function fmt(n) { return Number(n||0).toLocaleString("id-ID") }

export default function OpnameForm({ ingredients, onBack, onSubmit, saving, stationColor, staff, station }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [search, setSearch] = useState("")
  const [counts, setCounts] = useState([])

  useEffect(() => {
    let allowedIngs = ingredients || []
    
    let isOwner = false
    try {
      const roles = Array.isArray(staff?.role) ? staff.role : []
      if (roles.some(r => typeof r === "string" && r.toLowerCase() === "owner")) isOwner = true
      if (typeof staff?.name === "string" && staff.name.toLowerCase().includes("claudy")) isOwner = true
    } catch(e) {
      console.error("Error checking owner", e)
    }
    
    if (!isOwner) {
      allowedIngs = (ingredients||[]).filter(i => {
         if (i.station && Array.isArray(i.station)) {
           return i.station.some(s => typeof s === "string" && s.toLowerCase() === (station || "").toLowerCase())
         } else if (i.station && typeof i.station === "string") {
           return i.station.toLowerCase() === (station || "").toLowerCase()
         }
         return true // If ingredient has no station assigned, let them count it
      })
    }
    
    setCounts(allowedIngs.map(i => ({
      ingredient_id: i.id,
      name: i.name,
      unit: i.unit,
      conversions: i.conversions || [],
      input_unit: i.unit,
      system_qty: i.stock || 0,
      actual_qty: ""
    })))
  }, [ingredients, staff, station])

  const filtered = counts.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
  const filledCount = counts.filter(i => i.actual_qty !== "").length

  const handleSubmit = () => {
    if (filledCount === 0) {
      alert("Please enter at least one quantity.")
      return
    }
    const items = counts.filter(i => i.actual_qty !== "")
    onSubmit({ date, items })
  }

  const handleUpdate = (id, field, val) => {
    setCounts(prev => prev.map(x => x.ingredient_id === id ? { ...x, [field]: val } : x))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f5f6fa" }}>
      {/* Modern Header */}
      <div style={{ padding: "16px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>Stock Count</div>
          <div style={{ fontSize: 13, color: "#666" }}>{filledCount} items filled</div>
        </div>
      </div>

      
        

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 100px 20px" }}>
        
        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Count Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} max={new Date().toISOString().slice(0,10)} 
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9" }} />
        </div>

        <div style={{ background: "#fff", padding: "12px 16px", borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ingredient..." 
            style={{ border: "none", padding: "4px 0", fontSize: 15, flex: 1, outline: "none" }} />
          {search && <button onClick={()=>setSearch("")} style={{ background: "none", border: "none", color: "#999", fontSize: 20, cursor: "pointer" }}>✕</button>}
        </div>

        <div style={{ fontSize: 13, color: "#888", marginBottom: 16, fontWeight: 500, textAlign: "center" }}>
          Only fill items you counted. Leave blank to skip.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(item => {
            const filled = item.actual_qty !== ""
            return (
              <div key={item.ingredient_id} style={{ 
                background: "#fff", padding: "14px 16px", borderRadius: 16, display: "flex", alignItems: "center", gap: 12, 
                boxShadow: filled ? "0 4px 12px rgba(0,135,90,0.1)" : "0 2px 6px rgba(0,0,0,0.03)",
                border: filled ? "2px solid #00875A" : "2px solid transparent",
                transition: "all 0.2s"
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>System: <span style={{ fontWeight: 600 }}>{fmt(item.system_qty)} {item.unit}</span></div>
                </div>
                
                <div style={{ 
                  display: "flex", alignItems: "center", background: filled ? "#E3FCEF" : "#F4F5F7", 
                  borderRadius: 12, padding: "4px", border: filled ? "1px solid #00875A" : "1px solid #E8ECF0", flexShrink: 0,
                  width: 140
                }}>
                  <input type="text" inputMode="decimal" value={item.actual_qty}
                    onChange={e => handleUpdate(item.ingredient_id, "actual_qty", e.target.value)}
                    placeholder="—" 
                    style={{ 
                      width: 50, textAlign: "center", padding: "8px 4px", fontSize: 16, fontWeight: 700, 
                      background: "transparent", color: filled ? "#00875A" : "#111", border: "none", outline: "none"
                    }} />
                    
                  <div style={{ width: 1, height: 24, background: filled ? "rgba(0,135,90,0.2)" : "#D1D5DB", margin: "0 4px" }} />
                    
                  {item.conversions.length > 0 ? (
                    <select value={item.input_unit} onChange={e => handleUpdate(item.ingredient_id, "input_unit", e.target.value)}
                      style={{ flex: 1, minWidth: 0, padding: "8px 4px", fontSize: 14, fontWeight: 600, border: "none", background: "transparent", outline: "none", cursor: "pointer", color: filled ? "#00875A" : "#444" }}>
                      <option value={item.unit}>{item.unit}</option>
                      {item.conversions.map(c => <option key={c.unit} value={c.unit}>{c.unit}</option>)}
                    </select>
                  ) : (
                    <div style={{ flex: 1, minWidth: 0, padding: "8px 4px", fontSize: 14, fontWeight: 600, color: filled ? "#00875A" : "#888", textAlign: "center" }}>
                      {item.unit}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Action Button */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 20px", background: "linear-gradient(rgba(255,255,255,0), rgba(255,255,255,1) 30%)", zIndex: 20 }}>
        <button onClick={handleSubmit} disabled={saving} 
          style={{ 
            width: "100%", padding: 18, background: stationColor || "#0066FF", color: "#fff", border: "none", borderRadius: 16, 
            fontSize: 16, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            opacity: saving ? 0.7 : 1,
            transition: "transform 0.1s",
          }}>
          {saving ? "Submitting..." : `Submit Count ${filledCount > 0 ? `(${filledCount} items)` : ""}`}
        </button>
      </div>
    </div>
  )
}
