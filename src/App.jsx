import { useEffect, useState } from "react"
import POS from "./pos/POS"
import Backoffice from "./backoffice/Backoffice"
import StaffPortal from "./staff/StaffPortal"
import OwnerApp from "./owner/OwnerApp"

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
  if (path === "/owner"      || path.startsWith("/owner/"))      return <OwnerApp />
  return <POS />
}

export default App
