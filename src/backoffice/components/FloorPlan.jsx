import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const SHAPES   = ["square","round","rectangle"]
const SECTIONS = ["Indoor","Outdoor","VIP Room","Bar","Takeaway"]
const EMPTY    = { name:"", capacity:4, shape:"square", area:"Indoor", active:true }

const STATUS_COLORS = {
  Available: { bg:"#E3FCEF", border:"#00875A", text:"#00875A" },
  Occupied:  { bg:"#FFEBE6", border:"#DE350B", text:"#DE350B" },
  Reserved:  { bg:"#FFF7E6", border:"#FF8B00", text:"#FF8B00" },
  Inactive:  { bg:"#F4F5F7", border:"#DFE1E6", text:"#97A0AF" },
}

function TableViz({ shape, name, capacity, status="Available", active=true }) {
  const st = active ? STATUS_COLORS[status]||STATUS_COLORS.Available : STATUS_COLORS.Inactive
  const base = {
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    fontWeight:800, fontSize:13, color:st.text, background:st.bg,
    border:"2.5px solid "+st.border, cursor:"default", userSelect:"none", transition:"all 0.15s"
  }
  if (shape==="round")
    return <div style={{ ...base, width:80, height:80, borderRadius:"50%" }}>
      <span style={{ fontSize:12, fontWeight:800 }}>{name}</span>
      <span style={{ fontSize:10, fontWeight:600, opacity:0.8 }}>{capacity}p</span>
    </div>
  if (shape==="rectangle")
    return <div style={{ ...base, width:110, height:60, borderRadius:10 }}>
      <span style={{ fontSize:12, fontWeight:800 }}>{name}</span>
      <span style={{ fontSize:10, fontWeight:600, opacity:0.8 }}>{capacity}p</span>
    </div>
  return <div style={{ ...base, width:80, height:80, borderRadius:14 }}>
    <span style={{ fontSize:12, fontWeight:800 }}>{name}</span>
    <span style={{ fontSize:10, fontWeight:600, opacity:0.8 }}>{capacity}p</span>
  </div>
}

export default function FloorPlan() {
  const [tables,  setTables]  = useState([])
  const [modal,   setModal]   = useState(null) // null | "add" | table_object
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState("All")
  const [view,    setView]    = useState("grid") // grid | list

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("tables").select("*").order("name")
    setTables(data||[])
    setLoading(false)
  }

  const sections = ["All", ...SECTIONS.filter(s => tables.some(t=>t.area===s)||true)]
  const filtered = tables.filter(t => section==="All" || t.area===section)

  function openAdd()    { setForm(EMPTY); setModal("add") }
  function openEdit(t)  { setForm({...t}); setModal(t) }
  function closeModal() { setModal(null); setForm(EMPTY) }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name:     form.name.trim(),
      capacity: parseInt(form.capacity)||4,
      shape:    form.shape||"square",
      section:  form.area||"Indoor",
      active:   form.active!==false,
      status:   form.status||"Available",
    }
    if (modal==="add") {
      const { error } = await supabase.from("tables").insert(payload)
      if (error) { alert("Error: "+error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from("tables").update(payload).eq("id", form.id)
      if (error) { alert("Error: "+error.message); setSaving(false); return }
    }
    await load()
    closeModal()
    setSaving(false)
  }

  async function deleteTable(id) {
    if (!confirm("Delete this table?")) return
    await supabase.from("tables").delete().eq("id",id)
    setTables(prev=>prev.filter(t=>t.id!==id))
    closeModal()
  }

  const total    = tables.length
  const active   = tables.filter(t=>t.active).length
  const capacity = tables.reduce((s,t)=>s+(t.capacity||0),0)

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[["Total Tables",total,"#0052CC"],["Active",active,"#00875A"],["Total Capacity",capacity+" pax","#FF8B00"],["Sections",SECTIONS.filter(s=>tables.some(t=>t.area===s)).length,"#6554C0"]].map(([l,v,c])=>(
          <div key={l} style={{ background:"#fff",borderRadius:12,padding:"16px 20px",border:"1px solid #f0f0f0" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#6B778C",marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:24,fontWeight:900,color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["All",...SECTIONS].map(s=>(
            <button key={s} onClick={()=>setSection(s)} className={"bo-btn bo-btn-sm "+(section===s?"bo-btn-primary":"bo-btn-ghost")}>{s}</button>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={()=>setView(v=>v==="grid"?"list":"grid")} className="bo-btn bo-btn-ghost bo-btn-sm">
            {view==="grid"?"📋 List":"⊞ Grid"}
          </button>
          <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Table</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {Object.entries(STATUS_COLORS).map(([status,st])=>(
          <div key={status} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12 }}>
            <div style={{ width:12,height:12,borderRadius:3,background:st.bg,border:"1.5px solid "+st.border }} />
            <span style={{ color:st.text,fontWeight:600 }}>{status}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      {loading ? <div style={{ padding:40,textAlign:"center",color:"var(--ink5)" }}>Loading...</div>
      : filtered.length===0 ? (
        <div className="bo-card" style={{ textAlign:"center",padding:48,color:"var(--ink5)" }}>
          No tables in this section — click + Add Table
        </div>
      ) : view==="grid" ? (
        /* Grid view */
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))", gap:14 }}>
          {filtered.map(t=>(
            <div key={t.id} style={{ background:"#fff",border:"1.5px solid #f0f0f0",borderRadius:16,overflow:"hidden",opacity:t.active?1:0.6 }}>
              <div style={{ padding:16,display:"flex",justifyContent:"center",alignItems:"center",background:"var(--surface)",minHeight:110 }}>
                <TableViz shape={t.shape} name={t.name} capacity={t.capacity} status={t.status||"Available"} active={t.active} />
              </div>
              <div style={{ padding:"10px 14px" }}>
                <div style={{ fontSize:14,fontWeight:800,color:"#0A1628" }}>{t.name}</div>
                <div style={{ fontSize:11,color:"#6B778C",marginTop:2 }}>{t.area} · {t.capacity} pax · {t.shape}</div>
              </div>
              <div style={{ display:"flex",borderTop:"1px solid #f0f0f0" }}>
                <button onClick={()=>openEdit(t)}
                  style={{ flex:1,padding:"10px 0",fontSize:13,fontWeight:700,color:"var(--brand)",background:"none",border:"none",borderRight:"1px solid #f0f0f0",cursor:"pointer" }}>
                  Edit
                </button>
                <button onClick={()=>deleteTable(t.id)}
                  style={{ flex:1,padding:"10px 0",fontSize:13,fontWeight:700,color:"var(--red)",background:"none",border:"none",cursor:"pointer" }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="bo-card" style={{ padding:0,overflow:"hidden" }}>
          <table className="bo-table">
            <thead><tr><th>Table</th><th>Section</th><th>Shape</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(t=>{
                const st = t.active ? STATUS_COLORS[t.status||"Available"] : STATUS_COLORS.Inactive
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight:700 }}>{t.name}</td>
                    <td style={{ fontSize:12 }}>{t.area}</td>
                    <td style={{ fontSize:12,textTransform:"capitalize" }}>{t.shape}</td>
                    <td>{t.capacity} pax</td>
                    <td><span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:st.bg,color:st.text }}>{t.active?t.status||"Available":"Inactive"}</span></td>
                    <td>
                      <div style={{ display:"flex",gap:6 }}>
                        <button onClick={()=>openEdit(t)} className="bo-btn bo-btn-ghost bo-btn-sm">Edit</button>
                        <button onClick={()=>deleteTable(t.id)} className="bo-btn bo-btn-sm" style={{ color:"var(--red)",border:"1px solid var(--red)",background:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12 }}>Del</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="bo-overlay" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal" style={{ maxWidth:480 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Add Table":"Edit — "+form.name}</div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row">
                <label className="bo-label">Table Name *</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" placeholder="e.g. Table 1, VIP 1, Bar 2" autoFocus />
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14 }}>
                <div>
                  <label className="bo-label">Capacity (pax)</label>
                  <input type="number" min={1} max={30} value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))} className="bo-input" />
                </div>
                <div>
                  <label className="bo-label">Section</label>
                  <select value={form.area} onChange={e=>setForm(f=>({...f,area:e.target.value}))} className="bo-select">
                    {SECTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Shape</label>
                <div style={{ display:"flex",gap:8 }}>
                  {[["square","⬛ Square"],["round","⭕ Round"],["rectangle","▬ Long"]].map(([sh,l])=>(
                    <button key={sh} type="button" onClick={()=>setForm(f=>({...f,shape:sh}))}
                      className={"bo-btn bo-btn-sm "+(form.shape===sh?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Status</label>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  {["Available","Occupied","Reserved"].map(st=>(
                    <button key={st} type="button" onClick={()=>setForm(f=>({...f,status:st}))}
                      style={{ padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",
                        border:"1.5px solid "+(form.status===st||(!form.status&&st==="Available")?STATUS_COLORS[st].border:"#DFE1E6"),
                        background:(form.status===st||(!form.status&&st==="Available"))?STATUS_COLORS[st].bg:"#fff",
                        color:(form.status===st||(!form.status&&st==="Available"))?STATUS_COLORS[st].text:"#42526E" }}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              {/* Preview */}
              <div style={{ display:"flex",justifyContent:"center",padding:"16px 0",background:"var(--surface)",borderRadius:10,marginTop:8 }}>
                <TableViz shape={form.shape} name={form.name||"T1"} capacity={form.capacity||4} status={form.status||"Available"} active={form.active!==false} />
              </div>
              <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:12 }}>
                <input type="checkbox" checked={form.active!==false} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} style={{ width:16,height:16,accentColor:"var(--brand)" }} />
                <span style={{ fontSize:13,fontWeight:600 }}>Active (visible in POS)</span>
              </label>
            </div>
            <div className="bo-modal-footer">
              {modal!=="add" && <button onClick={()=>deleteTable(form.id)} className="bo-btn bo-btn-danger">Delete</button>}
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving||!form.name} className="bo-btn bo-btn-primary">
                {saving?"Saving...":modal==="add"?"Add Table":"Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
