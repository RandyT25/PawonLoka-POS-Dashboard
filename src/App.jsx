import { useEffect, useState } from "react"
import { seedDatabase } from "./lib/seed"
import POS from "./pos/POS"
import Backoffice from "./backoffice/Backoffice"
import StaffPortal from "./staff/StaffPortal"

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/"
  const isBackoffice = path === "/backoffice" || path.startsWith("/backoffice/")
  const isStaff = path === "/staff" || path.startsWith("/staff/")
  const isPos = path === "/pos" || path.startsWith("/pos/")

  const [ready, setReady] = useState(isBackoffice || isStaff || isPos)

  useEffect(() => {
    if (isBackoffice || isStaff || isPos) return
    seedDatabase().then(() => setReady(true))
  }, [])

  if (!ready) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"sans-serif", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:18, fontWeight:700 }}>Setting up PawonLoka...</div>
    </div>
  )

  if (isStaff) return <StaffPortal />
  if (isBackoffice) return <Backoffice />
  if (isPos) return <POS />
  return <POS />
}

export default App
