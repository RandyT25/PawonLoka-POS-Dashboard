import { useState } from "react"
import "./backoffice.css"
import Dashboard      from "./components/Dashboard"
import Products       from "./components/Products"
import Categories     from "./components/Categories"
import Modifiers      from "./components/Modifiers"
import Recipes        from "./components/RecipeEditor"
import Employees      from "./components/Employees"
import Shifts         from "./components/Shifts"
import Performance    from "./components/Performance"
import Customers      from "./components/Customers"
import Loyalty        from "./components/Loyalty"
import Reports        from "./components/Reports"
import Settings       from "./components/Settings"
import PaymentsTax    from "./components/PaymentsTax"
import Promotions     from "./components/Promotions"
import Bundles        from "./components/Bundles"
import Discounts      from "./components/Discounts"
import FloorPlan      from "./components/FloorPlan"
import ReceiptDesigner from "./components/ReceiptDesigner"
import Hardware       from "./components/Hardware"
import UsersAccess    from "./components/UsersAccess"
import AuditLog       from "./components/AuditLog"
import Integrations   from "./components/Integrations"

import Inventory from "./components/Inventory"
import StaffSubmissions from "./components/StaffSubmissions"
import ImportExport from "./components/ImportExport"
import Schedule from "./components/Schedule"
import Accounting from "./components/Accounting"

function ComingSoon({ title }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60vh", gap:12 }}>
      <div style={{ fontSize:48 }}>🚧</div>
      <div style={{ fontSize:18, fontWeight:800, color:"var(--ink)" }}>{title}</div>
      <div style={{ fontSize:13, color:"var(--ink5)" }}>This module is coming soon</div>
    </div>
  )
}

const BO_PIN      = "1999"
const SESSION_KEY = "bo_auth"

const MOBILE_TABS = [
  { id:"home",    icon:"🏠", label:"Home",    items:["dashboard","reports","accounting"] },
  { id:"menu",    icon:"🍽", label:"Menu",    items:["products","categories","modifiers","recipes"] },
  { id:"stock",   icon:"📦", label:"Stock",   items:["inv-overview","inv-ingredients","inv-po","inv-suppliers","inv-production","inv-opname","inv-waste","inv-movements","staff-submissions"] },
  { id:"people",  icon:"👥", label:"People",  items:["employees","shifts","schedule","performance","customers","loyalty"] },
  { id:"more",    icon:"⚙️", label:"More",    items:["promotions","bundles","discounts","payments","floorplan","import-export","settings","receipt-designer","hardware","usersaccess","audit-log","integrations"] },
]

const NAV = [
  { group:"Overview" },
  { id:"dashboard",        label:"Dashboard",         icon:"📊" },
  { id:"reports",          label:"Reports",            icon:"📈" },
  { group:"Finance" },
  { id:"accounting",       label:"Accounting",         icon:"🧾" },
  { group:"Menu" },
  { id:"products",         label:"Products",           icon:"🍽" },
  { id:"categories",       label:"Categories",         icon:"🏷" },
  { id:"modifiers",        label:"Modifiers",          icon:"✏️" },
  { id:"recipes",          label:"Recipes & COGS",     icon:"📒" },
  { group:"Inventory" },
  { id:"inv-overview",     label:"Overview",           icon:"📦" },
  { id:"inv-ingredients",  label:"Ingredients",        icon:"🧂" },
  { id:"inv-po",           label:"Purchase Orders",    icon:"🛒" },
  { id:"inv-suppliers",    label:"Suppliers",          icon:"🏭" },
  { id:"inv-production",   label:"Production",         icon:"⚙️" },
  { id:"inv-opname",       label:"Stock Opname",       icon:"🔢" },
  { id:"inv-waste",        label:"Waste Recording",    icon:"🗑" },
  { id:"inv-movements",    label:"Movement History",   icon:"📋" },
  { id:"staff-submissions", label:"Staff Reports",       icon:"📱" },
  { group:"People" },
  { id:"employees",        label:"Employees",          icon:"👤" },
  { id:"shifts",           label:"Shifts",             icon:"🕐" },
  { id:"schedule",         label:"Schedule",           icon:"📅" },
  { id:"performance",      label:"Performance",        icon:"📉" },
  { id:"customers",        label:"Customers",          icon:"⭐" },
  { id:"loyalty",          label:"Loyalty & Vouchers", icon:"🏆" },
  { group:"Sales" },
  { id:"promotions",       label:"Promotions",         icon:"🎁" },
  { id:"bundles",          label:"Bundle Packages",    icon:"📦" },
  { id:"discounts",        label:"Discounts",          icon:"✂️" },
  { id:"payments",         label:"Payments & Tax",     icon:"💳" },
  { group:"Operations" },
  { id:"floorplan",        label:"Floor Plan",         icon:"🪑" },
  { group:"System" },
  { id:"import-export",     label:"Import / Export",    icon:"📂" },
  { id:"settings",         label:"Settings",           icon:"⚙️" },
  { id:"receipt-designer", label:"Receipt Designer",   icon:"🖨" },
  { id:"hardware",         label:"Hardware",           icon:"🔧" },
  { id:"users-access",     label:"Users & Access",     icon:"🔑" },
  { id:"audit-log",        label:"Audit Log",          icon:"📜" },
  { id:"integrations",     label:"Integrations",       icon:"🔌" },
]

const SCREENS = {
  dashboard:         Dashboard,
  reports:           Reports,
  accounting:        Accounting,
  products:          Products,
  categories:        Categories,
  modifiers:         Modifiers,
  recipes:           Recipes,
  "inv-overview":    () => <Inventory initialTab="inv-overview" />,
  "inv-ingredients": () => <Inventory initialTab="inv-ingredients" />,
  "inv-po":          () => <Inventory initialTab="inv-po" />,
  "inv-suppliers":   () => <Inventory initialTab="inv-suppliers" />,
  "inv-production":  () => <Inventory initialTab="inv-production" />,
  "inv-opname":      () => <Inventory initialTab="inv-opname" />,
  "inv-waste":       () => <Inventory initialTab="inv-waste" />,
  "inv-movements":   () => <Inventory initialTab="inv-movements" />,
  "staff-submissions": StaffSubmissions,
  "import-export":      ImportExport,
  employees:         Employees,
  shifts:            Shifts,
  schedule:          Schedule,
  performance:       Performance,
  customers:         Customers,
  loyalty:           Loyalty,
  promotions:        Promotions,
  bundles:           Bundles,
  discounts:         Discounts,
  payments:          PaymentsTax,
  floorplan:         FloorPlan,
  settings:          Settings,
  "receipt-designer":ReceiptDesigner,
  hardware:          Hardware,
  "users-access":    UsersAccess,
  "audit-log":       AuditLog,
  integrations:      Integrations,
}

function BackofficeLogin({ onAuth }) {
  const [pin,   setPin]   = useState("")
  const [error, setError] = useState("")
  const [shake, setShake] = useState(false)

  function press(val) {
    if (val==="del") { setPin(p=>p.slice(0,-1)); setError(""); return }
    if (pin.length>=6) return
    const next = pin+val
    setPin(next)
    if (next.length===BO_PIN.length) setTimeout(()=>check(next),120)
  }

  function check(code) {
    if (code===BO_PIN) { sessionStorage.setItem(SESSION_KEY,"1"); onAuth() }
    else { setShake(true); setError("Wrong PIN"); setPin(""); setTimeout(()=>setShake(false),500) }
  }

  return (
    <div className="bo-login">
      <div className="bo-login-card" style={{ animation:shake?"shake 0.4s ease":"none" }}>
        <div className="bo-login-logo">🍳 PawonLoka</div>
        <div className="bo-login-sub">Back Office · Staff Access</div>
        <div className="bo-pin-dots">
          {Array.from({length:BO_PIN.length},(_,i)=>(
            <div key={i} className={"bo-pin-dot"+(i<pin.length?" filled":"")} />
          ))}
        </div>
        <div className="bo-pin-err">{error}</div>
        <div className="bo-pin-pad">
          {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i)=>(
            k===""?<div key={i}/>:
            <button key={k+i} className="bo-pin-key" onClick={()=>press(k)}>{k==="del"?"⌫":k}</button>
          ))}
        </div>
        <a href="/" className="bo-back-link">← Back to POS</a>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  )
}

export default function Backoffice() {
  const [authed, setAuthed] = useState(()=>sessionStorage.getItem(SESSION_KEY)==="1")
  const [active, setActive] = useState("dashboard")
  const [mobileSubMenu, setMobileSubMenu] = useState(null)

  function logout() { sessionStorage.removeItem(SESSION_KEY); setAuthed(false) }

  if (!authed) return <BackofficeLogin onAuth={()=>setAuthed(true)} />

  const Screen = SCREENS[active] || Dashboard

  return (
    <div className="bo-app">
      <div className="bo-sidebar">
        <div className="bo-sidebar-logo">
          <img src="/logo.png" alt="PawonLoka" onError={e=>{e.target.style.display="none"}} style={{ width:56, height:56, borderRadius:12, objectFit:"contain", marginBottom:6, display:"block", background:"#fff", padding:4 }} />
          <div className="bo-sidebar-logo-name">PawonLoka</div>
          <div className="bo-sidebar-logo-sub">Back Office</div>
        </div>
        <nav className="bo-nav">
          {NAV.map((n,i)=>n.group
            ?<div key={i} className="bo-nav-group">{n.group}</div>
            :(
              <button key={n.id} className={"bo-nav-item"+(active===n.id?" active":"")} onClick={()=>setActive(n.id)}>
                <span className="bo-nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            )
          )}
        </nav>
        <div className="bo-sidebar-footer">

          <button onClick={logout} className="bo-logout">Log Out</button>
        </div>
      </div>
      <div className="bo-main">
        <div className="bo-topbar">
          <div className="bo-topbar-title">{NAV.find(n=>n.id===active)?.label}</div>
          <div className="bo-topbar-date">{new Date().toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
        </div>
        <div className="bo-content"><Screen onNavChange={setActive} /></div>
        <nav className="bo-bottom-nav" style={{ display:"none" }}>
          {MOBILE_TABS.map(tab => {
            const isActive = tab.items.includes(active)
            return (
              <button key={tab.id} className={"bo-bottom-nav-item"+(isActive?" active":"")}
                onClick={()=>{ setMobileSubMenu(s=>s===tab.id?null:tab.id); if(!isActive) setActive(tab.items[0]) }}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
        {mobileSubMenu && (
          <div className="bo-mobile-submenu" onClick={()=>setMobileSubMenu(null)}>
            <div onClick={e=>e.stopPropagation()} style={{ background:"#1a1a2e", borderRadius:"20px 20px 0 0", paddingBottom:"env(safe-area-inset-bottom)" }}>
              <div style={{ width:40, height:4, background:"rgba(255,255,255,0.2)", borderRadius:2, margin:"10px auto 8px" }} />
              {MOBILE_TABS.find(t=>t.id===mobileSubMenu)?.items.map(id=>{
                const item = NAV.find(n=>n.id===id)
                if (!item) return null
                return (
                  <button key={id} onClick={()=>{setActive(id);setMobileSubMenu(null)}}
                    style={{ display:"flex", alignItems:"center", gap:14, width:"100%", padding:"13px 20px",
                      border:"none", background:active===id?"rgba(0,102,255,0.25)":"transparent",
                      color:active===id?"#fff":"rgba(255,255,255,0.65)", fontSize:14,
                      fontWeight:active===id?700:400, cursor:"pointer",
                      borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize:20, width:28, textAlign:"center" }}>{item.icon}</span>
                    <span style={{ flex:1, textAlign:"left" }}>{item.label}</span>
                    {active===id && <span style={{ fontSize:16, color:"#0066ff" }}>●</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
