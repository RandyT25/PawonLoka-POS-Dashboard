import { useState } from "react"
import SearchableSelect from "./SearchableSelect.jsx"

function fmt(n) { return Number(n||0).toLocaleString("id-ID") }
function parseNum(v) {
  if (!v) return 0
  return parseFloat(v.toString().replace(/,/g,"."))||0
}

export default function WasteForm({ ingredients, subRecipes, onBack, onSubmit, saving, stationColor }) {
  const [date, setDate] = useState(getBusinessDateStr())
  const [ingredientId, setIngredientId] = useState("")
  const [qty, setQty] = useState("")
  const [unit, setUnit] = useState("")
  const [reason, setReason] = useState("Expired")
  const [notes, setNotes] = useState("")

  const allItems = [...(ingredients||[]), ...(subRecipes||[])].sort((a,b)=>a.name.localeCompare(b.name))
  const itemsById = {}
  for (const i of allItems) itemsById[i.id] = i

  const selectedItem = itemsById[ingredientId]

  function biggestUnit(ing) {
    if (!ing) return ""
    if (!ing.conversions || ing.conversions.length === 0) return ing.unit
    return ing.conversions[ing.conversions.length-1].unit
  }

  const handleSubmit = () => {
    if (!ingredientId || !qty) {
      alert("Select an item and enter quantity")
      return
    }
    onSubmit({
      ingredient_id: ingredientId,
      qty,
      unit: unit || biggestUnit(selectedItem),
      reason,
      notes,
      date
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f5f6fa" }}>
      <div style={{ padding: "16px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>Waste / Spoilage</div>
          <div style={{ fontSize: 13, color: "#666" }}>Report damaged or expired items</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 100px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} max={getBusinessDateStr()} 
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9" }} />
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Item *</label>
          <SearchableSelect 
            options={allItems} 
            value={ingredientId} 
            onChange={v => {
              setIngredientId(v)
              setUnit(biggestUnit(itemsById[v]))
            }} 
            placeholder="Search ingredient or sub-recipe..." 
          />
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Quantity *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" inputMode="decimal" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" 
              style={{ flex: 1, padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 16, fontWeight: 600, background: "#f9f9f9" }} />
            
            {selectedItem && (() => {
              const currentUnit = unit || biggestUnit(selectedItem)
              if (selectedItem.conversions && selectedItem.conversions.length > 0) {
                 return (
                   <select value={currentUnit} onChange={e=>setUnit(e.target.value)} style={{ width: 100, padding: "12px 8px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9" }}>
                     <option value={selectedItem.unit}>{selectedItem.unit}</option>
                     {selectedItem.conversions.map(c => <option key={c.unit} value={c.unit}>{c.unit}</option>)}
                   </select>
                 )
              }
              return <div style={{ width: 100, background: "#f5f5f5", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, fontSize: 15, fontWeight: 600 }}>{selectedItem.unit}</div>
            })()}
          </div>
          {ingredientId && qty && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#fff0ed", borderRadius: 10, fontSize: 14, color: "#DE350B", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span>
              Est. Loss: Rp {fmt(parseNum(qty) * (selectedItem?.cost_per_unit||0))}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Reason *</label>
          <select value={reason} onChange={e=>setReason(e.target.value)} style={{ width: "100%", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9" }}>
            <option value="Expired">Expired</option>
            <option value="Rusak/Basi">Rusak/Basi</option>
            <option value="Tumpah/Jatuh">Tumpah/Jatuh</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Notes (Optional)</label>
          <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. dropped on floor" 
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9" }} />
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 20px", background: "linear-gradient(rgba(255,255,255,0), rgba(255,255,255,1) 30%)", zIndex: 20 }}>
        <button onClick={handleSubmit} disabled={saving} 
          style={{ 
            width: "100%", padding: 18, background: stationColor || "#DE350B", color: "#fff", border: "none", borderRadius: 16, 
            fontSize: 16, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(222,53,11,0.2)",
            opacity: saving ? 0.7 : 1,
            transition: "transform 0.1s",
          }}>
          {saving ? "Submitting..." : "Record Waste"}
        </button>
      </div>
    </div>
  )
}
