import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const SHAPES   = ["square","round","rectangle"]
const EMPTY    = { name:"", capacity:4, shape:"square", area:"Indoor", active:true, status:"Available" }

const STATUS_COLORS = {
  Available: { bg:"#E3FCEF", border:"#00875A", text:"#00875A" },
  Occupied:  { bg:"#FFEBE6", border:"#DE350B", text:"#DE350B" },
  Reserved:  { bg:"#FFF7E6", border:"#FF8B00", text:"#FF8B00" },
  Inactive:  { bg:"#F4F5F7", border:"#DFE1E6", text:"#97A0AF" },
}

function TableViz({ shape, name, capacity, status="Available", active=true }) {
  const st = active ? (STATUS_COLORS[status]||STATUS_COLORS.Available) : STATUS_COLORS.Inactive
  const base = { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    fontWeight:800, fontSize:13, color:st.text, background:st.bg, border:"2.5px solid "+st.border,
    cursor:"default", userSelect:"none" }
  if (shape==="round")
    return <div style={{ ...base, width:80, height:80, borderRadius:"50%" }}>
      <span style={{ fontSize:12 }}>{name}</span><span style={{ fontSize:10, opacity:0.8 }}>{capacity}p</span></div>
  if (shape==="rectangle")
    return <div style={{ ...base, width:110, height:60, borderRadius:10 }}>
      <span style={{ fontSize:12 }}>{name}</span><span style={{ fontSize:10, opacity:0.8 }}>{capacity}p</span></div>
  return <div style={{ ...base, width:80, height:80, borderRadius:14 }}>
    <span style={{ fontSize:12 }}>{name}</span><span style={{ fontSize:10, opacity:0.8 }}>{capacity}p</span></div>
}

export default function FloorPlan() {
  const [tables,    setTables]    = useState([])
  const [areas,     setAreas]     = useState(["Indoor","Outdoor","VIP Room","Bar"])
  const [modal,     setModal]     = useState(null)
  const [form,      setForm]      = useState(EMPTY)
  const [saving,    setSaving]    = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [activeArea,setActiveArea]= useState("All")
  const [view,      setView]      = useState("grid")
  const [bulk,      setBulk]      = useState(false)
  const [bulkForm,  setBulkForm]  = useState({ prefix:"Table", start:1, count:5, capacity:4, shape:"square", area:"Indoor" })
  const [areaModal, setAreaModal] = useState(false)
  const [areaForm,  setAreaForm]  = useState({ old:"", name:"" })
  const [selected,  setSelected]  = useState(new Set())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("tables").select("*").order("sort").order("name")
    // Natural sort client-side
    if (data) data.sort((a,b)=>{
      const na=a.name.replace(/(\d+)/g,n=>n.padStart(10,"0"))
      const nb=b.name.replace(/(\d+)/g,n=>n.padStart(10,"0"))
      return na.localeCompare(nb)
    })
    // Natural sort client-side
    if (data) data.sort((a,b)=>{
      const na=a.name.replace(/(\d+)/g,n=>n.padStart(10,"0"))
      const nb=b.name.replace(/(\d+)/g,n=>n.padStart(10,"0"))
      return na.localeCompare(nb)
    })
    const tbls = data||[]
    setTables(tbls)
    // Collect unique areas from DB
    const dbAreas = [...new Set(tbls.map(t=>t.area).filter(Boolean))]
    setAreas(prev => {
      const merged = [...new Set([...prev, ...dbAreas])]
      return merged
    })
    setLoading(false)
  }

  const filtered = tables.filter(t => activeArea==="All" || t.area===activeArea)

  function openAdd()    { setForm(EMPTY); setModal("add") }
  function openEdit(t)  { setForm({...t, area:t.area||"Indoor", shape:t.shape||"square", status:t.status||"Available"}); setModal("edit") }
  function closeModal() { setModal(null); setForm(EMPTY) }

  async function save() {
    if (!form.name?.trim()) return
    setSaving(true)
    const payload = { name:form.name.trim(), capacity:parseInt(form.capacity)||4,
      shape:form.shape||"square", area:form.area||"Indoor",
      active:form.active!==false, status:form.status||"Available" }
    let error
    if (modal==="add") {
      ({ error } = await supabase.from("tables").insert(payload))
    } else {
      ;({ error } = await supabase.from("tables").update(payload).eq("id", form.id))
    }
    if (error) alert("Error: "+error.message)
    else { await load(); closeModal() }
    setSaving(false)
  }

  async function deleteTable(id) {
    if (!confirm("Delete this table?")) return
    await supabase.from("tables").delete().eq("id", id)
    setTables(prev=>prev.filter(t=>t.id!==id))
    closeModal()
  }

  async function deleteSelected() {
    if (!selected.size) return
    if (!confirm(`Delete ${selected.size} tables?`)) return
    for (const id of selected) {
      await supabase.from("tables").delete().eq("id", id)
    }
    setSelected(new Set())
    await load()
  }

  async function bulkAdd() {
    if (!bulkForm.prefix || bulkForm.count<1) return
    setSaving(true)
    const rows = []
    for (let i=0; i<parseInt(bulkForm.count); i++) {
      rows.push({ name:`${bulkForm.prefix} ${parseInt(bulkForm.start)+i}`,
        capacity:parseInt(bulkForm.capacity)||4,
        shape:bulkForm.shape, area:bulkForm.area,
        active:true, status:"Available" })
    }
    const { error } = await supabase.from("tables").insert(rows)
    if (error) alert("Error: "+error.message)
    else { await load(); setBulk(false) }
    setSaving(false)
  }

  async function renameArea() {
    if (!areaForm.name.trim()) return
    // Update all tables in that area
    await supabase.from("tables").update({ area:areaForm.name.trim() }).eq("area", areaForm.old)
    setAreas(prev=>prev.map(a=>a===areaForm.old?areaForm.name.trim():a))
    setAreaModal(false)
    await load()
  }

  async function deleteArea(area) {
    if (!confirm(`Delete ALL tables in "${area}"?`)) return
    await supabase.from("tables").delete().eq("area", area)
    setAreas(prev=>prev.filter(a=>a!==area))
    setActiveArea("All")
    await load()
  }

  function addNewArea() {
    const name = prompt("New section/area name:")
    if (name?.trim()) setAreas(prev=>[...prev, name.trim()])
  }

  function toggleSelect(id) {
    setSelected(prev=>{
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const total    = tables.length
  const active   = tables.filter(t=>t.active!==false).length
  const capacity = tables.reduce((s,t)=>s+(t.capacity||0),0)

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[["Total Tables",total,"#0052CC"],["Active",active,"#00875A"],["Total Capacity",capacity+" pax","#FF8B00"],["Sections",areas.length,"#6554C0"]].map(([l,v,c])=>(
          <div key={l} style={{ background:"#fff",borderRadius:12,padding:"16px 20px",border:"1px solid #f0f0f0" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#6B778C",marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:24,fontWeight:900,color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Section tabs with edit */}
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        <button onClick={()=>setActiveArea("All")} className={"bo-btn bo-btn-sm "+(activeArea==="All"?"bo-btn-primary":"bo-btn-ghost")}>All</button>
        {areas.map(a=>(
          <div key={a} style={{ position:"relative", display:"inline-flex" }} className="area-pill-wrap">
            <button onClick={()=>setActiveArea(a)}
              style={{ padding:"6px 14px", borderRadius:20, fontSize:13, fontWeight:600, cursor:"pointer",
                border:"1.5px solid "+(activeArea===a?"var(--brand)":"#DFE1E6"),
                background:activeArea===a?"var(--brand)":"#fff",
                color:activeArea===a?"#fff":"#42526E",
                paddingRight: activeArea===a ? "14px" : "30px" }}>
              {a}
              {activeArea!==a && <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:"#9ca3af" }}>▼</span>}
            </button>
            {activeArea===a && (
              <div style={{ display:"flex", gap:4, marginLeft:4 }}>
                <button onClick={()=>{ setAreaForm({old:a,name:a}); setAreaModal(true) }}
                  style={{ padding:"4px 8px", border:"1px solid #DFE1E6", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:12, color:"#42526E" }}>
                  Rename
                </button>
                <button onClick={()=>deleteArea(a)}
                  style={{ padding:"4px 8px", border:"1px solid #fecaca", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:12, color:"var(--red)" }}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        <button onClick={addNewArea}
          style={{ padding:"6px 14px", borderRadius:20, fontSize:13, fontWeight:600, cursor:"pointer",
            border:"1.5px dashed #DFE1E6", background:"#fff", color:"#6B778C" }}>
          + Section
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
        <button onClick={()=>setBulk(true)} className="bo-btn bo-btn-ghost bo-btn-sm">⚡ Bulk Add</button>
        {selected.size>0 && (
          <button onClick={deleteSelected} className="bo-btn bo-btn-sm" style={{ background:"var(--red)",color:"#fff",border:"none" }}>
            🗑 Delete {selected.size} selected
          </button>
        )}
        {selected.size>0 && <button onClick={()=>setSelected(new Set())} className="bo-btn bo-btn-ghost bo-btn-sm">Clear selection</button>}
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={()=>setView(v=>v==="grid"?"list":"grid")} className="bo-btn bo-btn-ghost bo-btn-sm">
            {view==="grid"?"📋 List":"⊞ Grid"}
          </button>
          <button onClick={openAdd} className="bo-btn bo-btn-primary">+ Add Table</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {Object.entries(STATUS_COLORS).map(([s,st])=>(
          <div key={s} style={{ display:"flex",alignItems:"center",gap:5,fontSize:12 }}>
            <div style={{ width:12,height:12,borderRadius:3,background:st.bg,border:"1.5px solid "+st.border }} />
            <span style={{ color:st.text,fontWeight:600 }}>{s}</span>
          </div>
        ))}
        <span style={{ fontSize:12,color:"#6B778C",marginLeft:8 }}>Click table to select · Click Edit to modify</span>
      </div>

      {/* Content */}
      {loading ? <div style={{ padding:40,textAlign:"center",color:"var(--ink5)" }}>Loading...</div>
      : filtered.length===0 ? (
        <div className="bo-card" style={{ textAlign:"center",padding:48,color:"var(--ink5)" }}>
          No tables in this section. Click + Add Table or ⚡ Bulk Add.
        </div>
      ) : view==="grid" ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:14 }}>
          {filtered.map(t=>(
            <div key={t.id} onClick={()=>toggleSelect(t.id)}
              style={{ background:"#fff", border:"2px solid "+(selected.has(t.id)?"var(--brand)":"#f0f0f0"),
                borderRadius:16, overflow:"hidden", opacity:t.active!==false?1:0.6, cursor:"pointer",
                boxShadow:selected.has(t.id)?"0 0 0 2px var(--brand-lt)":"none" }}>
              <div style={{ padding:16,display:"flex",justifyContent:"center",alignItems:"center",background:"var(--surface)",minHeight:110 }}>
                <TableViz shape={t.shape||"square"} name={t.name} capacity={t.capacity} status={t.status||"Available"} active={t.active!==false} />
              </div>
              <div style={{ padding:"8px 12px" }}>
                <div style={{ fontSize:13,fontWeight:800,color:"#0A1628" }}>{t.name}</div>
                <div style={{ fontSize:11,color:"#6B778C" }}>{t.area||"Indoor"} · {t.capacity}p</div>
              </div>
              <div style={{ display:"flex",borderTop:"1px solid #f0f0f0" }}>
                <button onClick={e=>{e.stopPropagation();openEdit(t)}}
                  style={{ flex:1,padding:"9px 0",fontSize:12,fontWeight:700,color:"var(--brand)",background:"none",border:"none",cursor:"pointer" }}>Edit</button>
                <button onClick={e=>{e.stopPropagation();deleteTable(t.id)}}
                  style={{ flex:1,padding:"9px 0",fontSize:12,fontWeight:700,color:"var(--red)",background:"none",border:"none",borderLeft:"1px solid #f0f0f0",cursor:"pointer" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bo-card" style={{ padding:0,overflow:"hidden" }}>
          <table className="bo-table">
            <thead><tr>
              <th><input type="checkbox" onChange={e=>{ if(e.target.checked) setSelected(new Set(filtered.map(t=>t.id))); else setSelected(new Set()) }} /></th>
              <th>Table</th><th>Area</th><th>Shape</th><th>Capacity</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(t=>{
                const st = t.active!==false ? (STATUS_COLORS[t.status||"Available"]) : STATUS_COLORS.Inactive
                return (
                  <tr key={t.id}>
                    <td><input type="checkbox" checked={selected.has(t.id)} onChange={()=>toggleSelect(t.id)} /></td>
                    <td style={{ fontWeight:700 }}>{t.name}</td>
                    <td style={{ fontSize:12 }}>{t.area||"Indoor"}</td>
                    <td style={{ fontSize:12,textTransform:"capitalize" }}>{t.shape||"square"}</td>
                    <td>{t.capacity} pax</td>
                    <td><span style={{ fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:st.bg,color:st.text }}>{t.active!==false?t.status||"Available":"Inactive"}</span></td>
                    <td><div style={{ display:"flex",gap:6 }}>
                      <button onClick={()=>openEdit(t)} className="bo-btn bo-btn-ghost bo-btn-sm">Edit</button>
                      <button onClick={()=>deleteTable(t.id)} style={{ fontSize:12,padding:"4px 10px",border:"1px solid var(--red)",borderRadius:6,background:"none",color:"var(--red)",cursor:"pointer" }}>Del</button>
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Add Modal */}
      {bulk && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setBulk(false)}>
          <div className="bo-modal" style={{ maxWidth:440 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">⚡ Bulk Add Tables</div>
              <button className="bo-modal-close" onClick={()=>setBulk(false)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14 }}>
                <div><label className="bo-label">Prefix Name</label><input value={bulkForm.prefix} onChange={e=>setBulkForm(f=>({...f,prefix:e.target.value}))} className="bo-input" placeholder="Table" /></div>
                <div><label className="bo-label">Start Number</label><input type="number" value={bulkForm.start} onChange={e=>setBulkForm(f=>({...f,start:e.target.value}))} className="bo-input" /></div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14 }}>
                <div><label className="bo-label">How Many</label><input type="number" value={bulkForm.count} onChange={e=>setBulkForm(f=>({...f,count:e.target.value}))} className="bo-input" /></div>
                <div><label className="bo-label">Capacity Each</label><input type="number" value={bulkForm.capacity} onChange={e=>setBulkForm(f=>({...f,capacity:e.target.value}))} className="bo-input" /></div>
              </div>
              <div className="bo-form-row"><label className="bo-label">Area/Section</label>
                <select value={bulkForm.area} onChange={e=>setBulkForm(f=>({...f,area:e.target.value}))} className="bo-select">
                  {areas.map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="bo-form-row"><label className="bo-label">Shape</label>
                <div style={{ display:"flex",gap:8 }}>
                  {[["square","⬛ Square"],["round","⭕ Round"],["rectangle","▬ Long"]].map(([sh,l])=>(
                    <button key={sh} type="button" onClick={()=>setBulkForm(f=>({...f,shape:sh}))}
                      className={"bo-btn bo-btn-sm "+(bulkForm.shape===sh?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ padding:"10px 14px",background:"var(--surface)",borderRadius:8,fontSize:12,color:"#6B778C" }}>
                Will create: {bulkForm.prefix} {bulkForm.start}, {bulkForm.prefix} {parseInt(bulkForm.start)+1}, ... {bulkForm.prefix} {parseInt(bulkForm.start)+parseInt(bulkForm.count)-1}
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setBulk(false)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={bulkAdd} disabled={saving} className="bo-btn bo-btn-primary">{saving?"Adding...":"Add "+bulkForm.count+" Tables"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Area Modal */}
      {areaModal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setAreaModal(false)}>
          <div className="bo-modal" style={{ maxWidth:360 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">Rename Section</div>
              <button className="bo-modal-close" onClick={()=>setAreaModal(false)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row">
                <label className="bo-label">New Name for "{areaForm.old}"</label>
                <input value={areaForm.name} onChange={e=>setAreaForm(f=>({...f,name:e.target.value}))} className="bo-input" autoFocus />
              </div>
              <div style={{ fontSize:12,color:"#6B778C" }}>All tables in this section will be updated.</div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setAreaModal(false)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={renameArea} disabled={!areaForm.name} className="bo-btn bo-btn-primary">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal" style={{ maxWidth:480 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Add Table":"Edit — "+form.name}</div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row"><label className="bo-label">Table Name *</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" placeholder="e.g. Table 1, VIP 1" autoFocus />
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14 }}>
                <div><label className="bo-label">Capacity (pax)</label>
                  <input type="number" min={1} max={30} value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))} className="bo-input" /></div>
                <div><label className="bo-label">Area/Section</label>
                  <select value={form.area||"Indoor"} onChange={e=>setForm(f=>({...f,area:e.target.value}))} className="bo-select">
                    {areas.map(a=><option key={a}>{a}</option>)}
                  </select></div>
              </div>
              <div className="bo-form-row"><label className="bo-label">Shape</label>
                <div style={{ display:"flex",gap:8 }}>
                  {[["square","⬛ Square"],["round","⭕ Round"],["rectangle","▬ Long"]].map(([sh,l])=>(
                    <button key={sh} type="button" onClick={()=>setForm(f=>({...f,shape:sh}))}
                      className={"bo-btn bo-btn-sm "+(form.shape===sh?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="bo-form-row"><label className="bo-label">Status</label>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  {["Available","Occupied","Reserved"].map(st=>(
                    <button key={st} type="button" onClick={()=>setForm(f=>({...f,status:st}))}
                      style={{ padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",
                        border:"1.5px solid "+((form.status||"Available")===st?STATUS_COLORS[st].border:"#DFE1E6"),
                        background:(form.status||"Available")===st?STATUS_COLORS[st].bg:"#fff",
                        color:(form.status||"Available")===st?STATUS_COLORS[st].text:"#42526E" }}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex",justifyContent:"center",padding:"16px 0",background:"var(--surface)",borderRadius:10,marginTop:8 }}>
                <TableViz shape={form.shape||"square"} name={form.name||"T1"} capacity={form.capacity||4} status={form.status||"Available"} active={form.active!==false} />
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
