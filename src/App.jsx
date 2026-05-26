import { useEffect, useState } from "react"
import POS from "./pos/POS"
import Backoffice from "./backoffice/Backoffice"
import StaffPortal from "./staff/StaffPortal"

function App() {
  const [path, setPath] = useState(
    window.location.pathname.replace(/\/+$/, "") || "/"
  )

  useEffect(() => {
    const handler = () =>
      setPath(window.location.pathname.replace(/\/+$/, "") || "/")
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [])

  if (path === "/backoffice" || path.startsWith("/backoffice/")) return <Backoffice />
  if (path === "/staff"      || path.startsWith("/staff/"))      return <StaffPortal />
  return <POS />
}

export default App
