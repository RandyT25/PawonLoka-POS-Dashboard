import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const DEPT_COLORS = ["#6366F1","#10B981","#F59E0B","#3B82F6","#8B5CF6","#EF4444","#06B6D4","#F97316","#EC4899","#DC2626","#0EA5E9","#00875A"]
const DEPT_EMPTY  = { name:"", color:"#6366F1" }

export default function Departments() {
  const [depts,     setDepts]     = useState([])
  const [staff,     setStaff]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null) // null | "add" | deptRow
  const [form,      setForm]      = useState(DEPT_EMPTY)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data:deptData }, { data:staffData }] = await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase.from("staff").select("name,role").order("name"),
    ])
    setDepts(deptData||[])
    setStaff(staffData||[])
    setLoading(false)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    if (modal==="add") {
      await supabase.from("departments").insert({ id:"DEPT-"+Date.now(), name:form.name.trim(), color:form.color, sort_order:depts.length+1 })
    } else {
      await supabase.from("departments").update({ name:form.name.trim(), color:form.color }).eq("id", modal.id)
    }
    await load()
    setModal(null); setForm(DEPT_EMPTY); setSaving(false)
  }

  async function deleteDept() {
    if (!confirm(`Delete "${modal.name}"? Staff with this role will keep the name.`)) return
    await supabase.from("departments").delete().eq("id", modal.id)
    await load(); setModal(null)
  }

  const staffInDept = (name) => staff.filter(s => s.role === name)

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800 }}>Departments</div>
          <div style={{ fontSize:13, color:"var(--ink4)", marginTop:2 }}>{depts.length} departments · defines roles used across Staff and Schedule</div>
        </div>
        <button onClick={()=>{ setForm(DEPT_EMPTY); setModal("add") }} className="bo-btn bo-btn-primary">+ Add Department</button>
      </div>

      {/* Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14 }}>
        {depts.map(d => {
          const members = staffInDept(d.name)
          return (
            <div key={d.id} style={{ background:"#fff", borderRadius:16, overflow:"hidden", border:"1.5px solid #f0f0f0", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ background:d.color+"18", borderBottom:"1px solid "+d.color+"22", padding:"18px 18px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:d.color, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:16, fontWeight:800 }}>{d.name}</div>
                    <div style={{ fontSize:12, color:d.color, fontWeight:700 }}>{members.length} staff member{members.length!==1?"s":""}</div>
                  </div>
                </div>
                {members.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {members.map(s=>(
                      <span key={s.name} style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:10, background:d.color+"22", color:d.color }}>{s.name}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:"flex" }}>
                <button onClick={()=>{ setForm({name:d.name,color:d.color}); setModal(d) }}
                  style={{ flex:1, padding:"11px", border:"none", background:"none", fontSize:13, fontWeight:600, cursor:"pointer", color:"var(--brand)" }}>Edit</button>
                <button onClick={()=>{ setForm({name:d.name,color:d.color}); setModal(d) }}
                  style={{ flex:1, padding:"11px", border:"none", borderLeft:"1px solid #f0f0f0", background:"none", fontSize:13, fontWeight:600, cursor:"pointer", color:"var(--red)" }}>Delete</button>
              </div>
            </div>
          )
        })}
        {depts.length===0 && (
          <div style={{ gridColumn:"1/-1", textAlign:"center", color:"var(--ink5)", padding:60 }}>
            No departments yet. Add one to get started.
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="bo-modal" style={{ maxWidth:400 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Add Department":"Edit — "+modal.name}</div>
              <button className="bo-modal-close" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row">
                <label className="bo-label">Department Name *</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" autoFocus placeholder="e.g. Snack, Bar, Kasir" />
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Color</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {DEPT_COLORS.map(c=>(
                    <div key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                      style={{ width:30, height:30, borderRadius:8, background:c, cursor:"pointer",
                        border:form.color===c?"3px solid #0A1628":"3px solid transparent", boxSizing:"border-box" }} />
                  ))}
                </div>
              </div>
              {/* Live preview */}
              <div style={{ marginTop:14, padding:"14px 16px", borderRadius:12, background:form.color+"15", border:"1.5px solid "+form.color+"33", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:form.color }} />
                <div>
                  <div style={{ fontSize:15, fontWeight:800 }}>{form.name||"Department Name"}</div>
                  <div style={{ fontSize:12, color:form.color, fontWeight:700 }}>Preview</div>
                </div>
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setModal(null)} className="bo-btn bo-btn-ghost">Cancel</button>
              {modal!=="add" && <button onClick={deleteDept} className="bo-btn bo-btn-danger">Delete</button>}
              <button onClick={save} disabled={saving||!form.name.trim()} className="bo-btn bo-btn-primary">
                {saving?"Saving...":modal==="add"?"Add":"Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
