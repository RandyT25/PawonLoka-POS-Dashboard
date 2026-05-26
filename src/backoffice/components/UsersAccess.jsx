import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const PERMISSIONS = [
  { key:"pos",        label:"POS Access",        desc:"Can log in and use the point of sale" },
  { key:"backoffice", label:"Back Office",        desc:"Full access to backoffice management" },
  { key:"reports",    label:"View Reports",       desc:"Can view sales and performance reports" },
  { key:"refund",     label:"Process Refunds",    desc:"Can process order refunds" },
  { key:"discount",   label:"Apply Discounts",    desc:"Can apply manual discounts at checkout" },
  { key:"void",       label:"Void Transactions",  desc:"Can void completed transactions" },
  { key:"cash",       label:"Cash In / Out",      desc:"Can record cash movements" },
]

const ROLE_DEFAULTS = {
  Owner:   { pos:true,  void:true,  cash:true,  discount:true,  reports:true,  backoffice:true,  refund:true  },
  Manager: { pos:true,  void:true,  cash:true,  discount:true,  reports:true,  backoffice:false, refund:true  },
  Cashier: { pos:true,  void:false, cash:true,  discount:false, reports:false, backoffice:false, refund:false },
  Waiter:  { pos:true,  void:false, cash:false, discount:false, reports:false, backoffice:false, refund:false },
  Kitchen: { pos:false, void:false, cash:false, discount:false, reports:false, backoffice:false, refund:false },
}

const ROLES = Object.keys(ROLE_DEFAULTS)

const ROLE_COLORS = {
  Owner:"var(--red)", Manager:"var(--brand)", Cashier:"var(--green)",
  Waiter:"var(--amber)", Kitchen:"#6554C0"
}

function PinDots({ length=4 }) {
  return (
    <div style={{ display:"flex", gap:4 }}>
      {Array.from({length}).map((_,i) => (
        <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:"var(--ink3)" }} />
      ))}
    </div>
  )
}

export default function UsersAccess() {
  const [staff,   setStaff]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)
  const [form,    setForm]    = useState({ pin:"", confirmPin:"", role:"Cashier", permissions:{} })
  const [pinShow, setPinShow] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState("")
  const [search,  setSearch]  = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("staff").select("*").order("name")
    setStaff(data||[])
    setLoading(false)
  }

  function openEdit(s) {
    setForm({
      pin: "", confirmPin: "",
      role: s.role || "Cashier",
      permissions: s.permissions || ROLE_DEFAULTS[s.role] || ROLE_DEFAULTS.Cashier
    })
    setError(""); setPinShow(false)
    setModal(s)
  }

  function applyRoleDefaults(role) {
    setForm(f => ({ ...f, role, permissions: { ...ROLE_DEFAULTS[role] } }))
  }

  function togglePerm(key) {
    setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }))
  }

  async function save() {
    setError("")
    if (form.pin && form.pin.length !== 4) { setError("PIN must be exactly 4 digits"); return }
    if (form.pin && form.pin !== form.confirmPin) { setError("PINs do not match"); return }
    setSaving(true)
    const update = { role:form.role, permissions:form.permissions }
    if (form.pin) update.pin = form.pin
    await supabase.from("staff").update(update).eq("id", modal.id)
    await load()
    setModal(null)
    setSaving(false)
  }

  async function toggleActive(s) {
    await supabase.from("staff").update({ active: !s.active }).eq("id", s.id)
    setStaff(prev => prev.map(x => x.id===s.id ? {...x, active:!x.active} : x))
  }

  const filtered = staff.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()))
  const active  = staff.filter(s => s.active !== false)
  const inactive = staff.filter(s => s.active === false)

  return (
    <div>
      {/* Stats */}
      <div className="bo-metrics" style={{ gridTemplateColumns:"repeat(4,1fr)", marginBottom:16 }}>
        <div className="bo-met blue"><div className="bo-met-label">Total Staff</div><div className="bo-met-val">{staff.length}</div></div>
        <div className="bo-met green"><div className="bo-met-label">Active</div><div className="bo-met-val">{active.length}</div></div>
        <div className="bo-met amber"><div className="bo-met-label">Inactive</div><div className="bo-met-val">{inactive.length}</div></div>
        <div className="bo-met red"><div className="bo-met-label">Backoffice Access</div><div className="bo-met-val">{staff.filter(s=>s.permissions?.backoffice).length}</div></div>
      </div>

      {/* Search */}
      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center" }}>
        <div style={{ position:"relative", flex:1, maxWidth:300 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--ink5)" }}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} className="bo-input" placeholder="Search staff..." style={{ paddingLeft:28 }} />
        </div>
        <div style={{ fontSize:12, color:"var(--ink4)", marginLeft:"auto" }}>
          Click a staff member to edit their PIN and permissions
        </div>
      </div>

      {/* Staff cards */}
      {loading ? <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12 }}>
          {filtered.map(s => {
            const perms = s.permissions || ROLE_DEFAULTS[s.role] || {}
            const rc = ROLE_COLORS[s.role] || "var(--ink4)"
            const initials = s.name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()
            return (
              <div key={s.id} style={{ background:"#fff", border:"1.5px solid var(--surface3)", borderRadius:16, overflow:"hidden", opacity:s.active===false?0.6:1 }}>
                <div style={{ height:4, background:rc }} />
                <div style={{ padding:"14px 16px" }}>
                  {/* Header */}
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                    <div style={{ width:44, height:44, borderRadius:"50%", background:s.color||rc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:"#fff", flexShrink:0 }}>
                      {initials}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:"var(--ink)" }}>{s.name}</div>
                      <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:rc+"22", color:rc }}>{s.role}</span>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:10, color:"var(--ink5)", marginBottom:4 }}>PIN</div>
                      <PinDots />
                    </div>
                  </div>

                  {/* Permissions */}
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
                    {PERMISSIONS.map(p => (
                      <span key={p.key} style={{
                        fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
                        background: perms[p.key] ? "var(--brand-lt)" : "var(--surface)",
                        color: perms[p.key] ? "var(--brand)" : "var(--ink5)",
                        border: "1px solid " + (perms[p.key] ? "var(--brand)" : "var(--surface3)"),
                      }}>{p.label}</span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display:"flex", gap:6, borderTop:"1px solid var(--surface2)", paddingTop:12 }}>
                    <button onClick={()=>openEdit(s)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ flex:1 }}>Edit Access</button>
                    <button onClick={()=>toggleActive(s)} className="bo-btn bo-btn-sm bo-btn-ghost" style={{ flex:1, color:s.active===false?"var(--green)":"var(--amber)" }}>
                      {s.active===false ? "Activate" : "Deactivate"}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length===0 && <div style={{ gridColumn:"1/-1", textAlign:"center", color:"var(--ink5)", padding:48 }}>No staff found</div>}
        </div>
      )}

      {/* Edit Modal */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="bo-modal" style={{ maxWidth:480 }}>
            <div className="bo-modal-header">
              <div>
                <div className="bo-modal-title">Edit Access — {modal.name}</div>
                <div style={{ fontSize:11, color:"var(--ink5)", marginTop:2 }}>Changes apply on next login</div>
              </div>
              <button className="bo-modal-close" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="bo-modal-body">

              {/* Role */}
              <div className="bo-form-row">
                <label className="bo-label">Role</label>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {ROLES.map(r => (
                    <button key={r} onClick={()=>applyRoleDefaults(r)}
                      style={{ padding:"6px 14px", borderRadius:20, border:"1.5px solid "+(form.role===r?ROLE_COLORS[r]:"var(--surface3)"),
                        background:form.role===r?ROLE_COLORS[r]+"22":"#fff", color:form.role===r?ROLE_COLORS[r]:"var(--ink4)",
                        fontWeight:700, fontSize:12, cursor:"pointer" }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div className="bo-form-row">
                <label className="bo-label">Permissions</label>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {PERMISSIONS.map(p => (
                    <label key={p.key} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", padding:"8px 12px", borderRadius:"var(--r)", border:"1.5px solid "+(form.permissions[p.key]?"var(--brand)":"var(--surface3)"), background:form.permissions[p.key]?"var(--brand-lt)":"#fff" }}>
                      <input type="checkbox" checked={!!form.permissions[p.key]} onChange={()=>togglePerm(p.key)}
                        style={{ width:16, height:16, accentColor:"var(--brand)", flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:form.permissions[p.key]?"var(--brand)":"var(--ink)" }}>{p.label}</div>
                        <div style={{ fontSize:11, color:"var(--ink4)" }}>{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* PIN */}
              <div style={{ borderTop:"1px solid var(--surface3)", paddingTop:16, marginTop:4 }}>
                <label className="bo-label">Change PIN (leave blank to keep current)</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label className="bo-label" style={{ fontSize:10 }}>New PIN</label>
                    <div style={{ position:"relative" }}>
                      <input type={pinShow?"text":"password"} maxLength={4} value={form.pin}
                        onChange={e=>setForm(f=>({...f,pin:e.target.value.replace(/\D/g,"").slice(0,4)}))}
                        className="bo-input" placeholder="4 digits" style={{ letterSpacing:4, fontSize:18, fontWeight:700 }} />
                    </div>
                  </div>
                  <div>
                    <label className="bo-label" style={{ fontSize:10 }}>Confirm PIN</label>
                    <input type={pinShow?"text":"password"} maxLength={4} value={form.confirmPin}
                      onChange={e=>setForm(f=>({...f,confirmPin:e.target.value.replace(/\D/g,"").slice(0,4)}))}
                      className="bo-input" placeholder="Repeat PIN" style={{ letterSpacing:4, fontSize:18, fontWeight:700 }} />
                  </div>
                </div>
                <label style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, cursor:"pointer", fontSize:12, color:"var(--ink4)" }}>
                  <input type="checkbox" checked={pinShow} onChange={e=>setPinShow(e.target.checked)} style={{ accentColor:"var(--brand)" }} />
                  Show PIN
                </label>
                {form.pin && form.confirmPin && form.pin===form.confirmPin && (
                  <div style={{ marginTop:6, fontSize:12, color:"var(--green)", fontWeight:600 }}>✓ PINs match</div>
                )}
                {error && <div style={{ marginTop:6, fontSize:12, color:"var(--red)", fontWeight:600 }}>{error}</div>}
              </div>

              {/* Warning for backoffice */}
              {form.permissions.discount && (
                <div className="bo-form-row">
                  <label className="bo-label">Max Discount % (0 = unlimited)</label>
                  <input type="number" min="0" max="100"
                    value={form.permissions.max_discount||0}
                    onChange={e=>setForm(f=>({...f,permissions:{...f.permissions,max_discount:parseInt(e.target.value)||0}}))}
                    className="bo-input" style={{width:100}} />
                </div>
              )}
              {form.permissions.backoffice && (
                <div style={{ marginTop:12, padding:"10px 14px", background:"var(--amber-lt)", borderRadius:"var(--r)", fontSize:12, color:"var(--amber)", fontWeight:600 }}>
                  This staff will have full backoffice access using their PIN
                </div>
              )}
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setModal(null)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving} className="bo-btn bo-btn-primary">
                {saving?"Saving...":"Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
