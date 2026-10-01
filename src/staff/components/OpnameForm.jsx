import { getBusinessDateStr } from "../../shared/constants.js"
import { useState, useEffect } from "react"

function fmt(n) { return Number(n||0).toLocaleString("id-ID") }

function isSub(item) {
  return item?.category === "Semi-finished" || (typeof item?.name === "string" && item.name.toLowerCase().includes("(sub)"))
}

function matchesFilter(item, activeTab) {
  if (!activeTab || activeTab === "All") return true
  if (activeTab === "Sub-recipes") return isSub(item)
  const stations = Array.isArray(item.station) ? item.station.flat(Infinity) : (item.station ? [item.station] : [])
  if (stations.length === 0) return false
  return stations.some(s => typeof s === "string" && s.toLowerCase() === activeTab.toLowerCase())
}

const TABS = ["All", "Sub-recipes", "Kitchen", "Bar", "Snack", "Kasir"]

export default function OpnameForm({ ingredients, onBack, onSubmit, saving, stationColor, staff, station }) {
  const [date, setDate] = useState(getBusinessDateStr())
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState(station || "All")
  const [counts, setCounts] = useState([])

  useEffect(() => {
    const list = ingredients || []
    setCounts(prev => {
      const existing = {}
      for (const p of prev) {
        existing[p.ingredient_id] = p
      }
      return list.map(i => ({
        ingredient_id: i.id,
        name: i.name,
        unit: i.unit,
        category: i.category,
        station: i.station,
        conversions: i.conversions || [],
        input_unit: existing[i.id]?.input_unit || i.unit,
        system_qty: i.stock || 0,
        actual_qty: existing[i.id]?.actual_qty !== undefined ? existing[i.id].actual_qty : ""
      }))
    })
  }, [ingredients])

  const filtered = counts.filter(item => {
    if (search) {
      const q = search.trim().toLowerCase()
      const name = item.name.toLowerCase()
      const cat = (item.category || "").toLowerCase()
      if (name.includes(q) || cat.includes(q)) return true
      if (q === "mac and cheese" || q === "mac & cheese") return name.includes("macaroni")
      if (q === "keju parmesan" || q === "parmesan") return name.includes("parmesan")
      if (q === "tissu kecil" || q === "tissue kecil") return name.includes("tissu") && name.includes("kecil")
      if (q === "tissu sedang" || q === "tissue sedang") return name.includes("tissu") && name.includes("sedang")
      if (q === "tray sambel" || q === "tray sambal") return name.includes("tray") && (name.includes("sambal") || name.includes("sambel"))
      if (q === "kentang chicken steak") return name.includes("chicken steak") || (name.includes("kentang") && name.includes("steak"))
      return false
    }
    return matchesFilter(item, activeTab)
  })

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
          <div style={{ fontSize: 13, color: "#666" }}>{filledCount} items filled of {counts.length} total</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 100px 20px" }}>
        
        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)", marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Count Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} max={getBusinessDateStr()} 
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9", boxSizing: "border-box" }} />
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 12, WebkitOverflowScrolling: "touch" }}>
          {TABS.map(tab => {
            const isSelected = activeTab === tab
            const tabCount = counts.filter(i => matchesFilter(i, tab)).length
            return (
              <button 
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 20,
                  border: isSelected ? "none" : "1px solid #E5E7EB",
                  background: isSelected ? (tab === "Sub-recipes" ? "#7C3AED" : stationColor || "#0066FF") : "#fff",
                  color: isSelected ? "#fff" : "#4B5563",
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 2px 6px rgba(0,0,0,0.15)" : "none",
                  transition: "all 0.15s"
                }}
              >
                {tab} ({tabCount})
              </button>
            )
          })}
        </div>

        <div style={{ background: "#fff", padding: "12px 16px", borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${activeTab === "All" ? "everything" : activeTab.toLowerCase()}...`} 
            style={{ border: "none", padding: "4px 0", fontSize: 15, flex: 1, outline: "none" }} />
          {search && <button onClick={()=>setSearch("")} style={{ background: "none", border: "none", color: "#999", fontSize: 20, cursor: "pointer" }}>✕</button>}
        </div>

        <div style={{ fontSize: 13, color: "#888", marginBottom: 16, fontWeight: 500, textAlign: "center" }}>
          Only fill items you counted. Leave blank to skip.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ background: "#fff", padding: 32, borderRadius: 16, textAlign: "center", color: "#9CA3AF" }}>
              No items found matching "{search}" in {activeTab}.
            </div>
          ) : (
            filtered.map(item => {
              const filled = item.actual_qty !== ""
              const subItem = isSub(item)
              return (
                <div key={item.ingredient_id} style={{ 
                  background: "#fff", padding: "14px 16px", borderRadius: 16, display: "flex", alignItems: "center", gap: 12, 
                  boxShadow: filled ? "0 4px 12px rgba(0,135,90,0.1)" : "0 2px 6px rgba(0,0,0,0.03)",
                  border: filled ? "2px solid #00875A" : "2px solid transparent",
                  transition: "all 0.2s"
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                      {subItem && (
                        <span style={{ fontSize: 10, background: "#EDE9FE", color: "#6D28D9", padding: "2px 6px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
                          Sub-recipe
                        </span>
                      )}
                    </div>
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
                      
                    {item.conversions && item.conversions.length > 0 ? (
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
            })
          )}
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
