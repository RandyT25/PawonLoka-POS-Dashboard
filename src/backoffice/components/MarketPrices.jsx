import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import * as XLSX from "xlsx"

const fmt = n => "Rp " + Number(n||0).toLocaleString("id-ID")
const SOURCES = ["Market","Supplier","Online","Other"]

export default function MarketPrices() {
  const [prices,      setPrices]      = useState([])
  const [ingredients, setIngredients] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(false)
  const [form,        setForm]        = useState({ ingredient_id:"", price:"", unit:"", source:"Market", checked_by:"", notes:"", checked_at: new Date().toISOString().slice(0,10) })
  const [saving,      setSaving]      = useState(false)
  const [search,      setSearch]      = useState("")
  const [selectedIng, setSelectedIng] = useState("")
  const [dateRange,   setDateRange]   = useState(30)

  useEffect(() => { load() }, [dateRange])

  async function load() {
    setLoading(true)
    const from = new Date(Date.now() - dateRange * 86400000).toISOString().slice(0,10)
    const [{ data: p }, { data: i }] = await Promise.all([
      supabase.from("market_prices").select("*").gte("checked_at", from).order("checked_at", { ascending: false }),
      supabase.from("ingredients").select("id,name,unit,cost_per_unit").order("name")
    ])
    setPrices(p||[])
    setIngredients(i||[])
    setLoading(false)
  }

  function openAdd() {
    setForm({ ingredient_id:"", price:"", unit:"", source:"Market", checked_by:"", notes:"", checked_at: new Date().toISOString().slice(0,10) })
    setModal(true)
  }

  function handleIngSelect(id) {
    const ing = ingredients.find(i => i.id === id)
    setForm(f => ({ ...f, ingredient_id: id, unit: ing?.unit || "" }))
  }

  async function save() {
    if (!form.ingredient_id || !form.price) { alert("Select ingredient and enter price"); return }
    setSaving(true)
    const ing = ingredients.find(i => i.id === form.ingredient_id)
    await supabase.from("market_prices").insert({
      id: "MP-" + Date.now(),
      ingredient_id: form.ingredient_id,
      ingredient_name: ing?.name || "",
      price: parseFloat(form.price),
      unit: form.unit || ing?.unit || "",
      source: form.source,
      checked_by: form.checked_by,
      notes: form.notes,
      checked_at: form.checked_at,
    })
    setSaving(false)
    setModal(false)
    load()
  }

  async function deletePrice(id) {
    if (!confirm("Delete this entry?")) return
    await supabase.from("market_prices").delete().eq("id", id)
    setPrices(prev => prev.filter(p => p.id !== id))
  }

  function exportExcel() {
    const rows = filtered.map(p => ({
      "Date": p.checked_at, "Ingredient": p.ingredient_name,
      "Price": p.price, "Unit": p.unit, "Source": p.source||"",
      "Checked By": p.checked_by||"", "Notes": p.notes||""
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Market Prices")
    XLSX.writeFile(wb, "market_prices.xlsx")
  }

  const filtered = prices.filter(p => {
    const matchSearch = !search || p.ingredient_name?.toLowerCase().includes(search.toLowerCase())
    const matchIng = !selectedIng || p.ingredient_id === selectedIng
    return matchSearch && matchIng
  })

  // Group by ingredient for comparison
  const byIngredient = {}
  filtered.forEach(p => {
    if (!byIngredient[p.ingredient_id]) byIngredient[p.ingredient_id] = []
    byIngredient[p.ingredient_id].push(p)
  })

  // Build summary: latest price, po price, trend
  const summary = Object.entries(byIngredient).map(([ingId, entries]) => {
    const ing = ingredients.find(i => i.id === ingId)
    const sorted = [...entries].sort((a,b) => new Date(b.checked_at) - new Date(a.checked_at))
    const latest = sorted[0]
    const prev   = sorted[1]
    const poPricePerUnit = ing?.cost_per_unit || 0
    const diff = poPricePerUnit > 0 ? ((latest.price - poPricePerUnit) / poPricePerUnit * 100) : null
    const trend = prev ? ((latest.price - prev.price) / prev.price * 100) : null
    return { ingId, name: latest.ingredient_name, unit: latest.unit, latestPrice: latest.price,
      poPrice: poPricePerUnit, diff, trend, entries: sorted, source: latest.source }
  }).sort((a,b) => a.name.localeCompare(b.name))

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900, color:"var(--ink1)", marginBottom:4 }}>Market Price List</div>
          <div style={{ fontSize:13, color:"var(--ink4)" }}>Track ingredient prices from market & suppliers, compare vs your PO costs</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={exportExcel} className="bo-btn bo-btn-ghost">Export Excel</button>
          <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Price Check</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          ["Price Checks", filtered.length, "var(--brand)"],
          ["Ingredients Tracked", Object.keys(byIngredient).length, "#6554C0"],
          ["Above PO Price", summary.filter(s=>s.diff>0).length, "var(--red)"],
          ["Below PO Price", summary.filter(s=>s.diff!==null&&s.diff<=0).length, "var(--green)"],
        ].map(([l,v,c]) => (
          <div key={l} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:"1px solid #E8ECF0" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--ink4)", marginBottom:4, textTransform:"uppercase" }}>{l}</div>
            <div style={{ fontSize:24, fontWeight:900, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", padding:"12px 16px", marginBottom:16, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <input placeholder="Search ingredient..." value={search} onChange={e=>setSearch(e.target.value)} className="bo-input" style={{ flex:1, minWidth:180 }} />
        <select value={selectedIng} onChange={e=>setSelectedIng(e.target.value)} className="bo-select" style={{ flex:1, minWidth:180 }}>
          <option value="">All Ingredients</option>
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <div style={{ display:"flex", gap:6 }}>
          {[[7,"7D"],[30,"30D"],[90,"90D"]].map(([d,l]) => (
            <button key={d} onClick={()=>setDateRange(d)} className={"bo-btn bo-btn-sm "+(dateRange===d?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
          ))}
        </div>
        <button onClick={load} className="bo-btn bo-btn-ghost bo-btn-sm">Refresh</button>
      </div>

      {/* Summary table */}
      {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
        <>
          <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", overflow:"hidden", marginBottom:20 }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #E8ECF0", fontSize:13, fontWeight:800 }}>Price Summary vs PO Cost</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#F8FAFC" }}>
                  {["Ingredient","Unit","Latest Market Price","PO Cost","Difference","Trend","Source"].map(h => (
                    <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--ink4)", borderBottom:"1px solid #E8ECF0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 && <tr><td colSpan={7} style={{ textAlign:"center", padding:32, color:"var(--ink5)" }}>No price checks yet. Click "+ Add Price Check" to start.</td></tr>}
                {summary.map(s => (
                  <tr key={s.ingId} style={{ borderBottom:"1px solid #F0F4F8" }}>
                    <td style={{ padding:"10px 14px", fontWeight:700 }}>{s.name}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--ink4)" }}>{s.unit}</td>
                    <td style={{ padding:"10px 14px", fontWeight:700 }}>{fmt(s.latestPrice)}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--ink4)" }}>{s.poPrice > 0 ? fmt(s.poPrice) : "—"}</td>
                    <td style={{ padding:"10px 14px" }}>
                      {s.diff !== null ? (
                        <span style={{ fontSize:12, fontWeight:700, color: s.diff > 10 ? "var(--red)" : s.diff < -10 ? "var(--green)" : "var(--amber)" }}>
                          {s.diff > 0 ? "+" : ""}{s.diff.toFixed(1)}%
                          {s.diff > 10 ? " ⚠" : s.diff < -10 ? " ✓" : ""}
                        </span>
                      ) : <span style={{ color:"var(--ink5)" }}>—</span>}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      {s.trend !== null ? (
                        <span style={{ fontSize:12, fontWeight:700, color: s.trend > 0 ? "var(--red)" : "var(--green)" }}>
                          {s.trend > 0 ? "▲" : "▼"} {Math.abs(s.trend).toFixed(1)}%
                        </span>
                      ) : <span style={{ color:"var(--ink5)", fontSize:12 }}>First entry</span>}
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--ink4)" }}>{s.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Full history */}
          <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E8ECF0", overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #E8ECF0", fontSize:13, fontWeight:800 }}>Full Price History</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#F8FAFC" }}>
                  {["Date","Ingredient","Price","Unit","Source","Checked By","Notes",""].map(h => (
                    <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--ink4)", borderBottom:"1px solid #E8ECF0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign:"center", padding:32, color:"var(--ink5)" }}>No records found</td></tr>}
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom:"1px solid #F0F4F8" }}>
                    <td style={{ padding:"10px 14px", fontSize:12 }}>{p.checked_at}</td>
                    <td style={{ padding:"10px 14px", fontWeight:600 }}>{p.ingredient_name}</td>
                    <td style={{ padding:"10px 14px", fontWeight:700 }}>{fmt(p.price)}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--ink4)" }}>{p.unit}</td>
                    <td style={{ padding:"10px 14px", fontSize:12 }}>{p.source||"—"}</td>
                    <td style={{ padding:"10px 14px", fontSize:12 }}>{p.checked_by||"—"}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--ink4)" }}>{p.notes||"—"}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <button onClick={()=>deletePrice(p.id)} className="bo-btn bo-btn-danger bo-btn-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Modal */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="bo-modal" style={{ maxWidth:480 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">Add Price Check</div>
              <button className="bo-modal-close" onClick={()=>setModal(false)}>x</button>
            </div>
            <div className="bo-modal-body">
              <div style={{ display:"grid", gap:14 }}>
                <div>
                  <label className="bo-label">Ingredient *</label>
                  <select value={form.ingredient_id} onChange={e=>handleIngSelect(e.target.value)} className="bo-select">
                    <option value="">— Select ingredient —</option>
                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label className="bo-label">Price (Rp) *</label>
                    <input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} className="bo-input" placeholder="0" />
                  </div>
                  <div>
                    <label className="bo-label">Unit</label>
                    <input value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} className="bo-input" placeholder="kg, gr, pcs..." />
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label className="bo-label">Source</label>
                    <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} className="bo-select">
                      {SOURCES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="bo-label">Date</label>
                    <input type="date" value={form.checked_at} onChange={e=>setForm(f=>({...f,checked_at:e.target.value}))} className="bo-input" />
                  </div>
                </div>
                <div>
                  <label className="bo-label">Checked By</label>
                  <input value={form.checked_by} onChange={e=>setForm(f=>({...f,checked_by:e.target.value}))} className="bo-input" placeholder="Your name" />
                </div>
                <div>
                  <label className="bo-label">Notes</label>
                  <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="bo-input" placeholder="Optional notes" />
                </div>
                {form.ingredient_id && form.price && (
                  <div style={{ padding:"10px 14px", background:"var(--surface)", borderRadius:8, fontSize:12 }}>
                    {(() => {
                      const ing = ingredients.find(i => i.id === form.ingredient_id)
                      const po = ing?.cost_per_unit || 0
                      const market = parseFloat(form.price) || 0
                      const diff = po > 0 ? ((market - po) / po * 100) : null
                      return (
                        <div>
                          <span style={{ color:"var(--ink4)" }}>PO Cost: </span>
                          <strong>{po > 0 ? fmt(po) : "No PO data"}</strong>
                          {diff !== null && (
                            <span style={{ marginLeft:12, fontWeight:700, color: diff > 0 ? "var(--red)" : "var(--green)" }}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}% vs PO
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setModal(false)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving} className="bo-btn bo-btn-primary">{saving?"Saving...":"Save Price Check"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
