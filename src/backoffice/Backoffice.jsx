import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { supabase } from "../lib/supabase"

// Suppress PWA install prompt on desktop
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768
    if (!isMobile) e.preventDefault()
  })
}
import "./backoffice.css"

// Lazy-load all tab components — only the active tab is downloaded
const Dashboard        = lazy(() => import("./components/Dashboard"))
const SalesAnalysis    = lazy(() => import("./components/SalesAnalysis"))
const MenuPerformance  = lazy(() => import("./components/MenuPerformance"))
const Products        = lazy(() => import("./components/Products"))
const Categories      = lazy(() => import("./components/Categories"))
const Modifiers       = lazy(() => import("./components/Modifiers"))
const Recipes         = lazy(() => import("./components/RecipeEditor"))
const Employees       = lazy(() => import("./components/Employees"))
const Shifts          = lazy(() => import("./components/Shifts"))
const Performance     = lazy(() => import("./components/Performance"))
const Customers       = lazy(() => import("./components/Customers"))
const Loyalty         = lazy(() => import("./components/Loyalty"))
const Reports         = lazy(() => import("./components/Reports"))
const Settings        = lazy(() => import("./components/Settings"))
const PaymentsTax     = lazy(() => import("./components/PaymentsTax"))
const Promotions      = lazy(() => import("./components/Promotions"))
const Bundles         = lazy(() => import("./components/Bundles"))
const Discounts       = lazy(() => import("./components/Discounts"))
const FloorPlan       = lazy(() => import("./components/FloorPlan"))
const ReceiptDesigner        = lazy(() => import("./components/ReceiptDesigner"))
const KitchenTicketDesigner  = lazy(() => import("./components/KitchenTicketDesigner"))
const KitchenDisplay         = lazy(() => import("./components/KitchenDisplay"))
const Hardware        = lazy(() => import("./components/Hardware"))
const UsersAccess     = lazy(() => import("./components/UsersAccess"))
const AuditLog        = lazy(() => import("./components/AuditLog"))
const Integrations    = lazy(() => import("./components/Integrations"))
const Inventory       = lazy(() => import("./components/Inventory"))
const StaffSubmissions= lazy(() => import("./components/StaffSubmissions"))
const ImportExport    = lazy(() => import("./components/ImportExport"))
const Schedule        = lazy(() => import("./components/Schedule"))
const Attendance      = lazy(() => import("./components/Attendance"))
const DepartmentsPage = lazy(() => import("./components/Departments"))
const Accounting      = lazy(() => import("./components/Accounting"))
const Rekonsiliasi    = lazy(() => import("./components/Rekonsiliasi"))
const Orders          = lazy(() => import("./components/Orders"))
const MarketPrices    = lazy(() => import("./components/MarketPrices"))
const Profitability   = lazy(() => import("./components/Profitability"))

function useNotifications() {
  const [pending, setPending] = useState(0)
  const [notes,   setNotes]   = useState([])
  const channelRef = useRef(null)

  useEffect(() => {
    // Load initial pending count
    supabase.from("staff_submissions").select("id,type,submitted_by,submitted_at,data")
      .eq("status","pending").order("submitted_at",{ascending:false})
      .then(({data}) => {
        setPending((data||[]).length)
        setNotes((data||[]).map(s => ({
          id: s.id, type: s.type, by: s.submitted_by,
          station: s.data?.station||"",
          time: new Date(s.submitted_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}),
          read: false,
        })))
      })
    // Realtime
    channelRef.current = supabase.channel("bo_notif")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"staff_submissions"}, payload => {
        const s = payload.new
        setPending(n => n+1)
        setNotes(prev => [{
          id:s.id, type:s.type, by:s.submitted_by,
          station:s.data?.station||"",
          time:new Date(s.submitted_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}),
          read:false,
        }, ...prev])
        try {
          const ctx = new AudioContext()
          const o = ctx.createOscillator(); const g = ctx.createGain()
          o.connect(g); g.connect(ctx.destination)
          o.frequency.value=880; g.gain.value=0.2; o.start(); o.stop(ctx.currentTime+0.12)
        } catch {}
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"staff_submissions"}, () => {
        supabase.from("staff_submissions").select("id").eq("status","pending")
          .then(({data}) => setPending((data||[]).length))
      })
      .subscribe()
    return () => { supabase.removeChannel(channelRef.current) }
  }, [])

  function markRead() { setNotes(n => n.map(x=>({...x,read:true}))); setPending(0) }
  return { pending, notes, markRead }
}

const TYPE_ICONS = { opname:"📋", waste:"🗑️", production:"🏭", requisition:"🛒" }
const TYPE_LABELS = { opname:"Stock Count", waste:"Waste", production:"Production", requisition:"Request" }

function BellMenu({ pending, notes, onNav, markRead }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>{ setOpen(o=>!o); if(!open) markRead() }}
        style={{ position:"relative", background:"none", border:"none", cursor:"pointer", padding:"6px", borderRadius:8, color:"var(--ink3)", display:"flex", alignItems:"center", transition:"color 0.15s" }}
        onMouseEnter={e=>e.currentTarget.style.color="var(--ink)"}
        onMouseLeave={e=>e.currentTarget.style.color="var(--ink3)"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {pending > 0 && (
          <span style={{ position:"absolute", top:2, right:2, background:"#DE350B", color:"#fff", borderRadius:20, fontSize:9, fontWeight:900, minWidth:15, height:15, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px", lineHeight:1 }}>{pending}</span>
        )}
      </button>
      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:998 }} />
          <div style={{ position:"absolute", right:0, top:"calc(100% + 8px)", width:300, background:"#fff", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.15)", border:"1px solid var(--surface3)", zIndex:999, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--surface3)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:800 }}>Notifications</div>
              <button onClick={()=>{ setOpen(false); onNav("staff-submissions") }}
                style={{ fontSize:11, color:"var(--brand)", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>View All</button>
            </div>
            <div style={{ maxHeight:320, overflowY:"auto" }}>
              {notes.length === 0 ? (
                <div style={{ padding:"24px 16px", textAlign:"center", color:"var(--ink5)", fontSize:13 }}>No pending reports</div>
              ) : notes.slice(0,10).map(n => (
                <div key={n.id} onClick={()=>{ setOpen(false); onNav("staff-submissions") }}
                  style={{ padding:"10px 16px", borderBottom:"1px solid var(--surface)", cursor:"pointer", background:n.read?"#fff":"var(--brand-lt)", display:"flex", gap:10, alignItems:"flex-start" }}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
                  onMouseLeave={e=>e.currentTarget.style.background=n.read?"#fff":"var(--brand-lt)"}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{TYPE_ICONS[n.type]||"📄"}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700 }}>{TYPE_LABELS[n.type]||n.type} — {n.by}</div>
                    <div style={{ fontSize:11, color:"var(--ink4)" }}>{n.station && n.station+" · "}{n.time}</div>
                  </div>
                  {!n.read && <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--brand)", flexShrink:0, marginTop:4 }} />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}


const BO_PIN      = "1999"
const SESSION_KEY = "bo_auth"


const NAV = [
  { group:"Overview" },
  { id:"dashboard",         label:"Dashboard",          icon:"📊" },
  { id:"sales-analysis",    label:"Sales Analysis",     icon:"📈" },
  { id:"menu-performance",  label:"Menu Performance",   icon:"🍽" },
  { id:"reports",           label:"Reports & Export",   icon:"📋" },
  { group:"Finance" },
  { id:"accounting",       label:"Accounting",         icon:"🧾" },
  { id:"rekonsiliasi",     label:"Rekonsiliasi",       icon:"🔄" },
  { group:"Menu" },
  { id:"products",         label:"Products",           icon:"🍽" },
  { id:"categories",       label:"Categories",         icon:"🏷" },
  { id:"modifiers",        label:"Modifiers",          icon:"✏️" },
  { id:"recipes",          label:"Recipes & COGS",     icon:"📒" },
  { id:"market-prices",     label:"Market Prices",       icon:"🛒" },
  { id:"profitability",     label:"Profitability",       icon:"📊" },
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
  { id:"departments",      label:"Departments",        icon:"🏢" },
  { id:"shifts",           label:"Shifts",             icon:"🕐" },
  { id:"schedule",         label:"Schedule",           icon:"📅" },
  { id:"attendance",        label:"Attendance",         icon:"🕐" },
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
  { id:"kitchen-display",  label:"Kitchen Display",    icon:"🎫" },
  { group:"System" },
  { id:"import-export",     label:"Import / Export",    icon:"📂" },
  { id:"settings",         label:"Settings",           icon:"⚙️" },
  { id:"receipt-designer",       label:"Receipt Designer",        icon:"🖨" },
  { id:"kitchen-ticket-designer", label:"Kitchen Ticket Designer", icon:"🎫" },
  { id:"hardware",         label:"Hardware",           icon:"🔧" },
  { id:"users-access",     label:"Users & Access",     icon:"🔑" },
  { id:"audit-log",        label:"Audit Log",          icon:"📜" },
  { id:"integrations",     label:"Integrations",       icon:"🔌" },
]

const SCREENS = {
  dashboard:          Dashboard,
  "sales-analysis":   SalesAnalysis,
  "menu-performance": MenuPerformance,
  reports:            Reports,
  accounting:        Accounting,
  rekonsiliasi:      Rekonsiliasi,
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
  departments:       DepartmentsPage,
  shifts:            Shifts,
  orders:            Orders,
  'market-prices':   MarketPrices,
  profitability:     Profitability,
  schedule:          Schedule,
  attendance:        Attendance,
  performance:       Performance,
  customers:         Customers,
  loyalty:           Loyalty,
  promotions:        Promotions,
  bundles:           Bundles,
  discounts:         Discounts,
  payments:          PaymentsTax,
  floorplan:         FloorPlan,
  settings:          Settings,
  "receipt-designer":         ReceiptDesigner,
  "kitchen-ticket-designer":  KitchenTicketDesigner,
  "kitchen-display":          KitchenDisplay,
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
        <img src="/logo-backoffice.png" alt="PawonLoka"
          onError={e=>e.target.style.display="none"}
          style={{ width:80, height:80, objectFit:"contain", borderRadius:16, marginBottom:8 }} />
        <div className="bo-login-logo">PawonLoka</div>
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
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  )
}

function pageFromPath() {
  const segment = window.location.pathname.replace(/\/+$/, "").replace(/^\/backoffice\/?/, "")
  return segment || sessionStorage.getItem("bo_active") || "dashboard"
}

export default function Backoffice() {
  const [authed, setAuthed] = useState(()=>sessionStorage.getItem(SESSION_KEY)==="1")
  const [active, setActive] = useState(pageFromPath)

  const { pending, notes, markRead } = useNotifications(navTo)

  function navTo(id) {
    setActive(id)
    sessionStorage.setItem("bo_active", id)
    history.pushState(null, "", "/backoffice/" + id)
  }

  // Back / Forward browser buttons
  useEffect(() => {
    function onPop() { setActive(pageFromPath()) }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  useEffect(() => {
    const el = document.querySelector(".bo-nav-item.active")
    if (el) el.scrollIntoView({ block:"nearest", behavior:"instant" })
  }, [])


  const [mobileSidebar, setMobileSidebar] = useState(false)

  function logout() { sessionStorage.removeItem(SESSION_KEY); setAuthed(false) }

  if (!authed) return <BackofficeLogin onAuth={()=>setAuthed(true)} />

  const Screen = SCREENS[active] || Dashboard

  return (
    <div className="bo-app">
      <div className="bo-sidebar">
        <div className="bo-sidebar-logo">
          <img src="/logo-backoffice.png" alt="PawonLoka" onError={e=>{e.target.style.display="none"}} style={{ width:56, height:56, borderRadius:12, objectFit:"contain", marginBottom:6, display:"block", background:"#fff", padding:4 }} />
          <div className="bo-sidebar-logo-name">PawonLoka</div>
          <div className="bo-sidebar-logo-sub">Back Office</div>
        </div>
        <nav className="bo-nav">
          {NAV.map((n,i)=>n.group
            ?<div key={i} className="bo-nav-group">{n.group}</div>
            :(
              <button key={n.id} className={"bo-nav-item"+(active===n.id?" active":"")} onClick={()=>navTo(n.id)}>
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
          <button className="bo-hamburger" onClick={()=>setMobileSidebar(true)}>☰</button>
          <div className="bo-topbar-title">{NAV.find(n=>n.id===active)?.label}</div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginLeft:"auto" }}>
            <div className="bo-topbar-date">{new Date().toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
            <BellMenu pending={pending} notes={notes} onNav={navTo} markRead={markRead} />
          </div>
        </div>
        <div className="bo-content">
          <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",color:"#6B778C",fontSize:14}}>Loading...</div>}>
            <Screen onNavChange={navTo} />
          </Suspense>
        </div>
        {/* Mobile sidebar overlay */}
        {mobileSidebar && (
          <div onClick={()=>setMobileSidebar(false)}
            style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex" }}>
            <div onClick={e=>e.stopPropagation()}
              style={{ width:280,height:"100%",background:"#1a1a2e",display:"flex",flexDirection:"column",overflowY:"auto",WebkitOverflowScrolling:"touch" }}>
              {/* Header */}
              <div style={{ padding:"20px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:12 }}>
                <img src="/logo-backoffice.png" alt="" onError={e=>e.target.style.display="none"} style={{ width:36,height:36,borderRadius:8,objectFit:"contain" }} />
                <div>
                  <div style={{ fontSize:15,fontWeight:900,color:"#fff" }}>PawonLoka</div>
                  <div style={{ fontSize:10,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:1 }}>Back Office</div>
                </div>
                <button onClick={()=>setMobileSidebar(false)}
                  style={{ marginLeft:"auto",background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:"pointer",padding:4 }}>✕</button>
              </div>
              {/* Nav items */}
              <nav style={{ flex:1,padding:"8px 8px",overflowY:"auto" }}>
                {NAV.map((n,i) => n.group
                  ? <div key={i} style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",letterSpacing:"1.5px",textTransform:"uppercase",padding:"14px 16px 4px",marginTop:4 }}>{n.group}</div>
                  : <button key={n.id}
                      onClick={()=>{ navTo(n.id); setMobileSidebar(false) }}
                      style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,
                        color:active===n.id?"#fff":"rgba(255,255,255,0.55)",
                        background:active===n.id?"rgba(0,102,255,0.25)":"none",
                        border:"none",cursor:"pointer",width:"100%",textAlign:"left",
                        fontSize:13,fontWeight:active===n.id?700:400,marginBottom:1 }}>
                      <span style={{ fontSize:16,width:20,textAlign:"center" }}>{n.icon}</span>
                      <span>{n.label}</span>
                    </button>
                )}
              </nav>
              {/* Footer */}
              <div style={{ padding:"12px 8px",borderTop:"1px solid rgba(255,255,255,0.08)" }}>
                <button onClick={logout} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,color:"rgba(255,255,255,0.5)",background:"none",border:"none",cursor:"pointer",width:"100%",fontSize:13 }}>
                  <span>🚪</span><span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
