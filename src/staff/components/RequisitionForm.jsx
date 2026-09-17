import { useState } from "react"
import SearchableSelect from "./SearchableSelect.jsx"

const UOM_OPTIONS = ["kg","gr","L","ml","pcs","porsi","ikat","pack","botol","kaleng","dus"]

function biggestUnit(ing) {
  if (!ing) return ""
  if (!ing.conversions || ing.conversions.length === 0) return ing.unit
  let biggest = ing.unit
  let maxMultiplier = 1
  for (const c of ing.conversions) {
    if (c.multiplier > maxMultiplier) {
      maxMultiplier = c.multiplier
      biggest = c.unit
    }
  }
  return biggest
}

function parseNum(v) {
  if (!v) return 0
  return parseFloat(v.toString().replace(/,/g,"."))||0
}

export default function RequisitionForm({ ingredients, onBack, onSubmit, saving, stationColor }) {
  const [date, setDate] = useState(getBusinessDateStr())
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState([{ ingredient_id: "", qty: "", unit: "" }])

  const canSubmit = items.some(i => i.ingredient_id && parseNum(i.qty) > 0) && date

  const handleSubmit = () => {
    if (!canSubmit) return
    const validItems = items.filter(i => i.ingredient_id && parseNum(i.qty) > 0)
    onSubmit({
      date,
      notes,
      items: validItems.map(i => ({
        ...i,
        qty: parseNum(i.qty)
      }))
    })
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const removeItem = (index) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f5f6fa" }}>
      <datalist id="uom-options">{UOM_OPTIONS.map(u=><option key={u} value={u}/>)}</datalist>
      <div style={{ padding: "16px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>Request Ingredients</div>
          <div style={{ fontSize: 13, color: "#666" }}>Request items from storage / other stations</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 100px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        
        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Needed By Date *</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} 
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9", marginBottom: 16 }} />
          
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Notes (Optional)</label>
          <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. urgent, for dinner service..." 
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9" }} />
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111" }}>Items Needed</div>
            <button onClick={()=>setItems([...items,{ingredient_id:"",qty:"",unit:""}])} 
              style={{ background: "#f0f7ff", border: "none", color: "#0066ff", fontWeight: 700, fontSize: 13, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
              + Add Item
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((item, i) => {
              const selIng = ingredients.find(x => x.id === item.ingredient_id)
              const unitOptions = selIng ? [selIng.unit, ...(selIng.conversions||[]).map(c=>c.unit)].filter((u,idx,arr)=>u&&arr.indexOf(u)===idx) : []
              
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 12, borderBottom: i === items.length - 1 ? "none" : "1px solid #f0f0f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <SearchableSelect 
                        options={ingredients} 
                        value={item.ingredient_id} 
                        onChange={v => {
                          const ing = ingredients.find(x => x.id === v);
                          const newItems = [...items];
                          newItems[i] = { ...newItems[i], ingredient_id: v, unit: biggestUnit(ing) };
                          setItems(newItems);
                        }} 
                        placeholder="Search ingredient..." 
                      />
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: "#DE350B", fontSize: 18, cursor: "pointer", padding: "0 4px" }}>✕</button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="text" inputMode="decimal" value={item.qty} onChange={e => updateItem(i, "qty", e.target.value)} 
                      style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9", textAlign: "center" }} placeholder="Qty" />
                    
                    {unitOptions.length > 0 ? (
                      <select value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} 
                        style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9", textAlign: "center", appearance: "none" }}>
                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <input list="uom-options" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} 
                        style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9", textAlign: "center" }} placeholder="Unit" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 20px", background: "linear-gradient(rgba(255,255,255,0), rgba(255,255,255,1) 30%)", zIndex: 20 }}>
        <button onClick={handleSubmit} disabled={saving || !canSubmit} 
          style={{ 
            width: "100%", padding: 18, background: canSubmit ? (stationColor || "#0066ff") : "#D1D5DB", color: "#fff", border: "none", borderRadius: 16, 
            fontSize: 16, fontWeight: 800, cursor: canSubmit ? "pointer" : "not-allowed",
            boxShadow: canSubmit ? `0 4px 12px ${stationColor ? stationColor+"33" : "rgba(0,102,255,0.2)"}` : "none",
            opacity: saving ? 0.7 : 1,
            transition: "all 0.2s",
          }}>
          {saving ? "Submitting..." : "Send Request"}
        </button>
      </div>
    </div>
  )
}
