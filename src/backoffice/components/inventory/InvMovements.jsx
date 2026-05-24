import { useState, useEffect } from "react"
import { supabase } from "../../../lib/supabase"

const TYPE_COLORS = { Sale:"var(--brand)", Purchase:"var(--green)", Waste:"var(--red)", Production:"#6554C0", Adjustment:"var(--amber)" }

export default function InvMovements() {
  const [movements,   setMovements]   = useState([])
  const [ingredients, setIngredients] = useState([])
  const [filter,      setFilter]      = useState("all")
  const [modal,       setModal]       = useState(false)
  const [form,        setForm]        = useState({ ingredient_id:"", qty:"", unit:"", reason:"" })
  const [saving,      setSaving]      = useState(false)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:m }, { data:i }] = await Promise.all([
      supabase.from("stock_movements").select("*").order("created_at", { ascending:false }).limit(500),
      supabase.from("ingredients").select("id,name,unit,stock"),
    ])
    setMovements(m||[]); setIngredients(i||[])
    setLoading(false)
  }

  const types = ["all","Sale","Purchase","Waste","Production","Adjustment"]
  const filtered = filter==="all" ? movements : movements.filter(m=>m.type===filter)

  async function submitAdjustment() {
    const ing = ingredients.find(i=>i.id===form.ingredient_id)
    if (!ing || !form.qty || !form.reason) { alert("Fill all fields"); return }
    setSaving(true)
    const qty = parseFloat(form.qty)
    await supabase.from("stock_movements").insert({
      id:"MOV-"+Date.now(), type:"Adjustment",
      ingredient_id:ing.id, ingredient_name:ing.name,
      qty, unit:form.unit||ing.unit, ref:"MANUAL", note:form.reason,
      date:new Date().toISOString().slice(0,10),
      time:new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
    })
    await supabase.from("ingredients").update({ stock:Math.max(0,(ing.stock||0)+qty) }).eq("id",ing.id)
    await load()
    setModal(false)
    setForm({ ingredient_id:"", qty:"", unit:"", reason:"" })
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {types.map(t => {
            const cnt = t==="all" ? movements.length : movements.filter(m=>m.type===t).length
            return <button key={t} onClick={()=>setFilter(t)} className={"bo-btn bo-btn-sm "+(filter===t?"bo-btn-primary":"bo-btn-ghost")}>{t} ({cnt})</button>
          })}
        </div>
        <button onClick={()=>setModal(true)} className="bo-btn bo-btn-primary" style={{ marginLeft:"auto" }}>+ Manual Adjustment</button>
      </div>

      <div className="bo-card" style={{ padding:0, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
          <table className="bo-table">
            <thead><tr><th>ID</th><th>Date</th><th>Time</th><th>Type</th><th>Ingredient</th><th>Quantity</th><th>Reference</th><th>Note</th></tr></thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id}>
                  <td style={{ fontFamily:"monospace", fontSize:10, color:"var(--ink5)" }}>{m.id}</td>
                  <td style={{ fontSize:12 }}>{m.date}</td>
                  <td style={{ fontSize:12, color:"var(--ink5)" }}>{m.time||"—"}</td>
                  <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:(TYPE_COLORS[m.type]||"var(--ink5)")+"22", color:TYPE_COLORS[m.type]||"var(--ink5)" }}>{m.type}</span></td>
                  <td style={{ fontWeight:600 }}>{m.ingredient_name}</td>
                  <td style={{ fontWeight:700, color:m.qty<0?"var(--red)":"var(--green)" }}>{m.qty>0?"+":""}{m.qty} {m.unit}</td>
                  <td style={{ fontFamily:"monospace", fontSize:11, color:"var(--ink5)" }}>{m.ref||"—"}</td>
                  <td style={{ fontSize:11, color:"var(--ink4)" }}>{m.note||"—"}</td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={8} style={{ textAlign:"center", color:"var(--ink5)", padding:"32px 0" }}>No movement records</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="bo-modal">
            <div className="bo-modal-header">
              <div className="bo-modal-title">Manual Stock Adjustment</div>
              <button className="bo-modal-close" onClick={()=>setModal(false)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row"><label className="bo-label">Ingredient *</label>
                <select value={form.ingredient_id} onChange={e=>{
                  const ing=ingredients.find(i=>i.id===e.target.value)
                  setForm(f=>({...f,ingredient_id:e.target.value,unit:ing?.unit||""}))
                }} className="bo-select">
                  <option value="">— Select ingredient —</option>
                  {ingredients.map(i=><option key={i.id} value={i.id}>{i.name} — Current: {i.stock} {i.unit}</option>)}
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Adjustment Qty * <span style={{ fontSize:10, color:"var(--ink5)" }}>(use − for decrease)</span></label><input type="number" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))} className="bo-input" placeholder="e.g. -5 or +10" /></div>
                <div><label className="bo-label">Unit</label><input value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} className="bo-input" /></div>
              </div>
              <div className="bo-form-row"><label className="bo-label">Reason *</label><input value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} className="bo-input" placeholder="e.g. Counting error, damaged batch..." /></div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setModal(false)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={submitAdjustment} disabled={saving||!form.ingredient_id||!form.qty||!form.reason} className="bo-btn bo-btn-primary">{saving?"Saving...":"Record Adjustment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
