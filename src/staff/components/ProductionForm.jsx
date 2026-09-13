import { useState, useMemo } from "react"
import SearchableSelect from "./SearchableSelect.jsx"

function fmt(n) { return Number(n||0).toLocaleString("id-ID") }
function parseNum(v) {
  if (!v) return 0
  return parseFloat(v.toString().replace(/,/g,"."))||0
}

export default function ProductionForm({ ingredients, subRecipes, frozenProducts, subRecipeIngs, frozenRecipes, onBack, onSubmit, saving, stationColor }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [prodValue, setProdValue] = useState("")
  const [batchQty, setBatchQty] = useState("")
  const [notes, setNotes] = useState("")

  const ingredientsById = useMemo(() => {
    const map = {}
    for (const i of ingredients) map[i.id] = i
    return map
  }, [ingredients])

  const productionOptions = useMemo(() => {
    return [
      ...subRecipes.map(r => ({ id:"sub:"+r.id, name:r.name })),
      ...frozenProducts.map(p => ({ id:"prod:"+p.sku, name:p.name })),
    ].sort((a,b)=>a.name.localeCompare(b.name))
  }, [subRecipes, frozenProducts])

  const prodType = prodValue.startsWith("sub:") ? "sub" : (prodValue.startsWith("prod:") ? "product" : "")
  const prodId = prodValue.replace("sub:","").replace("prod:","")
  
  const selectedSub = prodType==="sub" ? subRecipes.find(s => s.id === prodId) : null
  const selectedProduct = prodType==="product" ? frozenProducts.find(p => p.sku === prodId) : null
  const selectedItem = selectedSub || selectedProduct

  const numBatch = parseNum(batchQty) || 0

  const recipeLines = prodType==="product"
    ? (prodId ? frozenRecipes.filter(l => l.product_id === prodId) : [])
    : (prodId ? subRecipeIngs.filter(l => l.sub_recipe_id === prodId) : [])

  const preview = recipeLines.map(l => {
    const ing = prodType==="product" ? ingredientsById[l.ingredient_id] : ingredients.find(i => i.id === l.ingredient_id)
    const total = l.qty * numBatch
    return { ingredient_id:l.ingredient_id, name:ing?.name||l.ingredient_name||"", perBatch:l.qty, unit:l.unit||ing?.unit||"", total, cost:total*(ing?.cost_per_unit||0) }
  })

  const totalCost = preview.reduce((s,p) => s+p.cost, 0)
  const canSubmit = selectedItem && numBatch > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      prodType,
      prodId,
      batchQty: numBatch,
      notes,
      date,
      recipeLines,
      selectedItem
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f5f6fa" }}>
      <div style={{ padding: "16px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>Production Batch</div>
          <div style={{ fontSize: 13, color: "#666" }}>Record items made today</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 100px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} max={new Date().toISOString().slice(0,10)} 
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9" }} />
        </div>

        <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Item to Produce *</label>
          <SearchableSelect
            options={productionOptions}
            value={prodValue}
            onChange={v => setProdValue(v)}
            placeholder="Select recipe or frozen item..."
          />
          {selectedSub && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fff8", borderRadius: 10, fontSize: 13, color: "#00875A", fontWeight: 700 }}>
              1 batch = {selectedSub.yield_qty} {selectedSub.yield_unit||"gr"} {selectedSub.name}
            </div>
          )}
          {selectedProduct && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fff8", borderRadius: 10, fontSize: 13, color: "#00875A", fontWeight: 700 }}>
              1 pack = 1 {selectedProduct.name}
            </div>
          )}
        </div>

        {selectedItem && (
          <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>
              {prodType==="product" ? "How many packs today? *" : "How many batches today? *"}
            </label>
            <input
              type="text" inputMode="decimal" value={batchQty} onChange={e => setBatchQty(e.target.value)}
              style={{ width: "100%", fontSize: 32, fontWeight: 900, textAlign: "center", padding: 18, border: "1px solid #E8ECF0", borderRadius: 16, background: "#f9f9f9", color: "#111" }}
              placeholder="0"
            />
          </div>
        )}

        {selectedItem && numBatch > 0 && preview.length > 0 && (
          <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "#111", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Ingredients Required</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#00875A", background: "#e3fcef", padding: "4px 8px", borderRadius: 8 }}>Auto-calculated</span>
            </div>
            {preview.map((p,i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i === preview.length-1 ? "none" : "1px solid #f5f5f5" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{p.perBatch} × {numBatch} {prodType==="product"?"pack":"batch"}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#00875A", background: "#f0fff8", padding: "6px 10px", borderRadius: 8 }}>
                  {p.total} <span style={{ fontSize: 13, fontWeight: 600 }}>{p.unit}</span>
                </div>
              </div>
            ))}
            {totalCost > 0 && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "#f0fff8", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#00875A" }}>Est. Cost</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#00875A" }}>Rp {fmt(totalCost)}</span>
              </div>
            )}
          </div>
        )}

        {selectedItem && (
          <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Notes (Optional)</label>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. slight recipe change..." 
              style={{ width: "100%", padding: "12px 14px", border: "1px solid #E8ECF0", borderRadius: 10, fontSize: 15, background: "#f9f9f9" }} />
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 20px", background: "linear-gradient(rgba(255,255,255,0), rgba(255,255,255,1) 30%)", zIndex: 20 }}>
        <button onClick={handleSubmit} disabled={saving || !canSubmit} 
          style={{ 
            width: "100%", padding: 18, background: canSubmit ? (stationColor || "#00875A") : "#D1D5DB", color: "#fff", border: "none", borderRadius: 16, 
            fontSize: 16, fontWeight: 800, cursor: canSubmit ? "pointer" : "not-allowed",
            boxShadow: canSubmit ? "0 4px 12px rgba(0,135,90,0.2)" : "none",
            opacity: saving ? 0.7 : 1,
            transition: "all 0.2s",
          }}>
          {saving ? "Submitting..." : "Log Production"}
        </button>
      </div>
    </div>
  )
}
