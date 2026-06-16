import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }

const ROLES_FALLBACK = ["Kasir","Bar","Snack","Kitchen","Cook","Head Cook","Head Kasir","Owner"]
const STAFF_COLORS   = ["#0066FF","#00875A","#FF8B00","#6554C0","#DE350B","#00B8D9","#10B981","#F59E0B","#EF4444"]
const DEPT_COLORS    = ["#6366F1","#10B981","#F59E0B","#3B82F6","#8B5CF6","#EF4444","#06B6D4","#F97316","#EC4899","#DC2626","#0EA5E9"]
const STAFF_EMPTY    = { name:"", role:"", pin:"", salary:0, color:"#0066FF", phone:"", active:true }
const DEPT_EMPTY     = { name:"", color:"#6366F1" }

const PERM_LABELS = { pos:"POS", backoffice:"Back Office", reports:"Reports", void:"Void", discount:"Discounts", cash:"Cash" }

export default function Employees() {
  const [tab,        setTab]       = useState("staff")
  const [staff,      setStaff]     = useState([])
  const [roles,      setRoles]     = useState(ROLES_FALLBACK)
  const [depts,      setDepts]     = useState([])
  const [loading,    setLoading]   = useState(true)
  const [filter,     setFilter]    = useState("all")
  const [search,     setSearch]    = useState("")

  // Staff modal
  const [modal,      setModal]     = useState(false)
  const [form,       setForm]      = useState(STAFF_EMPTY)
  const [saving,     setSaving]    = useState(false)
  const [showPin,    setShowPin]   = useState(false)
  const [detail,     setDetail]    = useState(null)

  // Dept modal
  const [deptModal,  setDeptModal] = useState(null)
  const [deptForm,   setDeptForm]  = useState(DEPT_EMPTY)
  const [deptSaving, setDeptSaving]= useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data }, { data:deptData }] = await Promise.all([
      supabase.from("staff").select("*").order("name"),
      supabase.from("departments").select("*").order("sort_order"),
    ])
    setStaff(data||[])
    if (deptData?.length) {
      setDepts(deptData)
      setRoles(deptData.map(d=>d.name))
    }
    setLoading(false)
  }

  // ── Staff CRUD ──────────────────────────────────────────────────
  function openAdd()   { setForm(STAFF_EMPTY); setModal("add") }
  function openEdit(s) { setForm({...s, pin:s.pin||"", salary:s.salary||0, phone:s.phone||""}); setModal("edit") }
  function closeModal(){ setModal(false); setForm(STAFF_EMPTY) }

  async function save() {
    if (!form.name) return
    if (form.pin && (form.pin.length!==4||!/^\d+$/.test(form.pin))) { alert("PIN must be 4 digits"); return }
    setSaving(true)
    const payload = { name:form.name.trim(), role:form.role, pin:form.pin||null, color:form.color, active:form.active!==false, salary:parseFloat(form.salary)||0, phone:form.phone||null, join_date:form.join_date||null }
    if (modal==="add") {
      await supabase.from("staff").insert({ ...payload, id:"STAFF-"+Date.now() })
    } else {
      await supabase.from("staff").update(payload).eq("id", form.id)
    }
    await load(); closeModal(); setSaving(false)
  }

  async function deleteStaff() {
    if (!confirm(`Delete ${form.name}? This cannot be undone.`)) return
    await supabase.from("staff").delete().eq("id", form.id)
    await load(); closeModal()
  }

  async function clockIn(s) {
    const now = new Date()
    const today = now.toISOString().slice(0,10)
    const attId = "ATT-"+s.name.replace(/\s/g,"")+"-"+today
    const { data:existing } = await supabase.from("attendance").select("*").eq("id",attId).maybeSingle()
    if (existing?.clock_in && !existing?.clock_out) {
      await supabase.from("attendance").update({ clock_out:now.toISOString() }).eq("id",attId)
      alert(`${s.name} clocked out at ${now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}`)
    } else {
      await supabase.from("attendance").upsert({ id:attId, staff_name:s.name, date:today, clock_in:now.toISOString(), status:"on_time" })
      alert(`${s.name} clocked in at ${now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}`)
    }
  }

  // ── Dept CRUD ───────────────────────────────────────────────────
  async function saveDept() {
    if (!deptForm.name.trim()) return
    setDeptSaving(true)
    if (deptModal==="add") {
      await supabase.from("departments").insert({ id:"DEPT-"+Date.now(), name:deptForm.name.trim(), color:deptForm.color, sort_order:depts.length+1 })
    } else {
      await supabase.from("departments").update({ name:deptForm.name.trim(), color:deptForm.color }).eq("id", deptModal.id)
    }
    await load()
    setDeptModal(null); setDeptForm(DEPT_EMPTY); setDeptSaving(false)
  }

  async function deleteDept(d) {
    if (!confirm(`Delete department "${d.name}"? Staff with this role will keep the name.`)) return
    await supabase.from("departments").delete().eq("id", d.id)
    await load(); setDeptModal(null)
  }

  // ── Derived ─────────────────────────────────────────────────────
  const active  = staff.filter(s=>s.active!==false)
  const flagged = staff.filter(s=>s.flagged)
  const filtered = staff.filter(s => {
    const matchFilter = filter==="all" || (filter==="active"&&s.active!==false)
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })
  function initials(name) { return (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() }
  const perms = (s) => { const p=s.permissions||{}; return Object.entries(PERM_LABELS).filter(([k])=>p[k]).map(([,v])=>v) }
  const deptColor = (roleName) => depts.find(d=>d.name===roleName)?.color || "#6B778C"

  return (
    <div>
      {/* Metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[["Total Staff",staff.length,"#0052CC"],["Departments",depts.length,"#6554C0"],["Active",active.length,"#00875A"],["Flagged",flagged.length,"#FF8B00"]].map(([l,v,c])=>(
          <div key={l} style={{ background:"#fff", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", border:"1px solid #f0f0f0" }}>
            <div style={{ fontSize:28, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:13, color:"#6B778C", marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
        {[["staff","Staff"],["depts","Departments"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={"bo-btn bo-btn-sm "+(tab===t?"bo-btn-primary":"bo-btn-ghost")}>{l}</button>
        ))}
        {tab==="staff" && <>
          <div style={{ display:"flex", gap:6, marginLeft:8 }}>
            {[["all","All"],["active","Active"]].map(([v,l])=>(
              <button key={v} onClick={()=>setFilter(v)}
                style={{ padding:"6px 16px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                  border:"1.5px solid "+(filter===v?"var(--brand)":"#DFE1E6"),
                  background:filter===v?"var(--brand)":"#fff", color:filter===v?"#fff":"#42526E" }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#6B778C" }}>⌕</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff..." className="bo-input" style={{ paddingLeft:30, width:180 }} />
            </div>
            <button onClick={openAdd} className="bo-btn bo-btn-primary bo-btn-sm">+ Add Employee</button>
          </div>
        </>}
        {tab==="depts" && (
          <button onClick={()=>{ setDeptForm(DEPT_EMPTY); setDeptModal("add") }} className="bo-btn bo-btn-primary bo-btn-sm" style={{ marginLeft:"auto" }}>+ Add Department</button>
        )}
      </div>

      {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : <>

        {/* ── Staff tab ── */}
        {tab==="staff" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
            {filtered.map(s => {
              const color = deptColor(s.role) !== "#6B778C" ? deptColor(s.role) : (s.color||"#0066FF")
              const cardColor = s.color||"#0066FF"
              const p = perms(s)
              return (
                <div key={s.id} style={{ background:"#fff", borderRadius:16, overflow:"hidden", border:"1.5px solid #f0f0f0", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", opacity:s.active===false?0.55:1 }}>
                  <div style={{ background:cardColor+"18", padding:"16px 16px 12px", borderBottom:"1px solid "+cardColor+"22", display:"flex", alignItems:"center", gap:12, position:"relative" }}>
                    <div style={{ width:46, height:46, borderRadius:"50%", background:cardColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:"#fff", flexShrink:0 }}>
                      {initials(s.name)}
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:"#0A1628" }}>{s.name}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:deptColor(s.role) }}>{s.role||"—"}</div>
                    </div>
                    <div style={{ position:"absolute", top:14, right:14, width:8, height:8, borderRadius:"50%", background:s.active!==false?"#36B37E":"#DFE1E6" }} />
                  </div>
                  <div style={{ padding:"12px 16px", fontSize:13, color:"#42526E" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}><span>📞</span><span>{s.phone||"—"}</span></div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}><span>📅</span><span>Since {s.join_date||s.created_at?.slice(0,10)||"—"}</span></div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}><span>💰</span><span>{fmt(s.salary||0)}/mo</span></div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span>🔑</span>
                      <span style={{ fontFamily:"monospace", letterSpacing:2 }}>PIN: ••••</span>
                      {p.map(label=>(
                        <span key={label} style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:6,
                          background:label==="Void"?"#FFEBE6":label==="Back Office"?"#E8F0FF":"#E3FCEF",
                          color:label==="Void"?"#DE350B":label==="Back Office"?"#0052CC":"#00875A" }}>{label}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"flex", borderTop:"1px solid #f0f0f0" }}>
                    <button onClick={()=>openEdit(s)} style={{ flex:1, padding:"10px", border:"none", background:"none", fontSize:13, fontWeight:600, cursor:"pointer", color:"#42526E" }}>Edit</button>
                    <button onClick={()=>setDetail(s)} style={{ flex:1, padding:"10px", border:"none", borderLeft:"1px solid #f0f0f0", background:"none", fontSize:13, fontWeight:600, cursor:"pointer", color:"#42526E" }}>Detail</button>
                    <button onClick={()=>clockIn(s)} style={{ flex:1, padding:"10px", border:"none", borderLeft:"1px solid #f0f0f0", background:"none", fontSize:13, fontWeight:700, cursor:"pointer", color:"#00875A" }}>Clock In</button>
                  </div>
                </div>
              )
            })}
            {filtered.length===0 && <div style={{ gridColumn:"1/-1", textAlign:"center", color:"var(--ink5)", padding:48 }}>No staff found</div>}
          </div>
        )}

        {/* ── Departments tab ── */}
        {tab==="depts" && (
          <div>
            <div style={{ fontSize:13, color:"var(--ink4)", marginBottom:14 }}>{depts.length} departments · used as role labels across Staff and Schedule</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
              {depts.map(d=>(
                <div key={d.id} style={{ background:"#fff", borderRadius:14, overflow:"hidden", border:"1.5px solid #f0f0f0", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ background:d.color+"18", borderBottom:"1px solid "+d.color+"22", padding:"18px 18px 14px", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:d.color, flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:15, fontWeight:800 }}>{d.name}</div>
                      <div style={{ fontSize:11, color:d.color, fontWeight:700, marginTop:2 }}>
                        {staff.filter(s=>s.role===d.name).length} staff
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", borderTop:"1px solid #f0f0f0" }}>
                    <button onClick={()=>{ setDeptForm({name:d.name,color:d.color}); setDeptModal(d) }}
                      style={{ flex:1, padding:"10px", border:"none", background:"none", fontSize:13, fontWeight:600, cursor:"pointer", color:"#42526E" }}>Edit</button>
                    <button onClick={()=>deleteDept(d)}
                      style={{ flex:1, padding:"10px", border:"none", borderLeft:"1px solid #f0f0f0", background:"none", fontSize:13, fontWeight:600, cursor:"pointer", color:"#DE350B" }}>Delete</button>
                  </div>
                </div>
              ))}
              {depts.length===0 && <div style={{ gridColumn:"1/-1", textAlign:"center", color:"var(--ink5)", padding:48 }}>No departments yet</div>}
            </div>
          </div>
        )}
      </>}

      {/* ── Staff Add/Edit Modal ── */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="bo-modal" style={{ maxWidth:480 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">{modal==="add"?"Add Employee":"Edit — "+form.name}</div>
              <button className="bo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Full Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" autoFocus /></div>
                <div><label className="bo-label">Phone</label><input value={form.phone||""} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="bo-input" /></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div><label className="bo-label">Department</label>
                  <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} className="bo-select">
                    <option value="">— Select —</option>
                    {roles.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div><label className="bo-label">PIN (4 digits)</label>
                  <div style={{ position:"relative" }}>
                    <input type={showPin?"text":"password"} maxLength={4} value={form.pin} onChange={e=>setForm(f=>({...f,pin:e.target.value.replace(/\D/g,"").slice(0,4)}))} className="bo-input" placeholder="••••" style={{ letterSpacing:4, fontSize:18, paddingRight:36 }} />
                    <button type="button" onClick={()=>setShowPin(p=>!p)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color:"var(--ink4)" }}>{showPin?"🙈":"👁"}</button>
                  </div>
                </div>
              </div>
              <div className="bo-form-row"><label className="bo-label">Join Date</label><input type="date" value={form.join_date||""} onChange={e=>setForm(f=>({...f,join_date:e.target.value}))} className="bo-input" /></div>
              <div className="bo-form-row"><label className="bo-label">Monthly Salary (Rp)</label><input type="number" value={form.salary===0?"":form.salary} onChange={e=>setForm(f=>({...f,salary:e.target.value}))} onFocus={e=>{if(e.target.value==="0")e.target.value=""}} onBlur={e=>{if(e.target.value==="")setForm(f=>({...f,salary:0}))}} placeholder="0" className="bo-input" /></div>
              <div className="bo-form-row">
                <label className="bo-label">Color</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {STAFF_COLORS.map(c=>(
                    <div key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                      style={{ width:28, height:28, borderRadius:"50%", background:c, cursor:"pointer", border:form.color===c?"3px solid #0A1628":"3px solid transparent", boxSizing:"border-box" }} />
                  ))}
                </div>
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginTop:8 }}>
                <input type="checkbox" checked={form.active!==false} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} style={{ width:16,height:16,accentColor:"var(--brand)" }} />
                <span style={{ fontSize:13, fontWeight:600 }}>Active</span>
              </label>
            </div>
            <div className="bo-modal-footer">
              <button onClick={closeModal} className="bo-btn bo-btn-ghost">Cancel</button>
              {modal==="edit" && <button onClick={deleteStaff} className="bo-btn bo-btn-danger">Delete</button>}
              <button onClick={save} disabled={saving||!form.name} className="bo-btn bo-btn-primary">{saving?"Saving...":modal==="add"?"Add":"Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setDetail(null)}>
          <div className="bo-modal" style={{ maxWidth:400 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">{detail.name} — Detail</div>
              <button className="bo-modal-close" onClick={()=>setDetail(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              {[["Department",detail.role||"—"],["Phone",detail.phone||"—"],["Salary",fmt(detail.salary||0)+"/mo"],["Status",detail.active!==false?"Active":"Inactive"],["Since",detail.join_date||detail.created_at?.slice(0,10)||"—"],["Permissions",perms(detail).join(", ")||"None"]].map(([k,v])=>(
                <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--surface2)",fontSize:13 }}>
                  <span style={{ color:"var(--ink4)",fontWeight:600 }}>{k}</span>
                  <span style={{ fontWeight:700 }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setDetail(null)} className="bo-btn bo-btn-ghost">Close</button>
              <button onClick={()=>{openEdit(detail);setDetail(null)}} className="bo-btn bo-btn-primary">Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Department Add/Edit Modal ── */}
      {deptModal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setDeptModal(null)}>
          <div className="bo-modal" style={{ maxWidth:380 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">{deptModal==="add"?"Add Department":"Edit — "+deptModal.name}</div>
              <button className="bo-modal-close" onClick={()=>setDeptModal(null)}>✕</button>
            </div>
            <div className="bo-modal-body">
              <div className="bo-form-row">
                <label className="bo-label">Department Name *</label>
                <input value={deptForm.name} onChange={e=>setDeptForm(f=>({...f,name:e.target.value}))} className="bo-input" autoFocus placeholder="e.g. Snack, Bar, Kasir" />
              </div>
              <div className="bo-form-row">
                <label className="bo-label">Color</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {DEPT_COLORS.map(c=>(
                    <div key={c} onClick={()=>setDeptForm(f=>({...f,color:c}))}
                      style={{ width:28, height:28, borderRadius:8, background:c, cursor:"pointer",
                        border:deptForm.color===c?"3px solid #0A1628":"3px solid transparent", boxSizing:"border-box" }} />
                  ))}
                </div>
                <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:deptForm.color }} />
                  <span style={{ fontSize:13, fontWeight:700, color:deptForm.color }}>{deptForm.name||"Preview"}</span>
                </div>
              </div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setDeptModal(null)} className="bo-btn bo-btn-ghost">Cancel</button>
              {deptModal!=="add" && <button onClick={()=>deleteDept(deptModal)} className="bo-btn bo-btn-danger">Delete</button>}
              <button onClick={saveDept} disabled={deptSaving||!deptForm.name.trim()} className="bo-btn bo-btn-primary">
                {deptSaving?"Saving...":deptModal==="add"?"Add":"Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
