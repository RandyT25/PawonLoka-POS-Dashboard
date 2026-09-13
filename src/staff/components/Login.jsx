import { useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Login({ allStaff, onLogin }) {
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handlePin = async (digit) => {
    setError("")
    if (pin.length < 4) {
      const newPin = pin + digit
      setPin(newPin)
      if (newPin.length === 4) {
        // verify
        setLoading(true)
        try {
          const { data } = await supabase.from("staff").select("id,name,pin,role").eq("name", selected).single()
          if (!data) {
            setError("Staff not found")
            setPin("")
          } else if (data.pin && data.pin !== newPin) {
            setError("Incorrect PIN")
            setPin("")
          } else {
            // success or no pin required
            onLogin(data)
          }
        } catch (e) {
          setError("Failed to verify PIN")
          setPin("")
        }
        setLoading(false)
      }
    }
  }

  const handleDelete = () => {
    setPin(p => p.slice(0, -1))
    setError("")
  }

  if (!selected) {
    return (
      <div style={{ padding: "40px 20px", maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
        <img src="/logo-staff.png" alt="PawonLoka" style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 20 }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Welcome to PawonLoka</h1>
        <p style={{ color: "#666", marginBottom: 32 }}>Select your name to continue</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {allStaff.map(name => (
            <button key={name} onClick={() => setSelected(name)}
              style={{
                padding: "16px", borderRadius: 16, border: "2px solid #E8ECF0", background: "#fff",
                fontSize: 16, fontWeight: 700, color: "#111", cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)", transition: "all 0.2s"
              }}>
              {name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "40px 20px", maxWidth: 400, margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <button onClick={() => { setSelected(null); setPin(""); setError("") }} style={{ alignSelf: "flex-start", background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>←</button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Hi, {selected}</div>
        <div style={{ color: "#666", marginBottom: 24 }}>Enter your 4-digit PIN</div>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 32 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: pin.length > i ? "#0066FF" : "#E8ECF0", transition: "background 0.2s" }} />
          ))}
        </div>

        {error && <div style={{ color: "#DE350B", fontWeight: 600, marginBottom: 16 }}>{error}</div>}
        {loading && <div style={{ color: "#0066FF", fontWeight: 600, marginBottom: 16 }}>Verifying...</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 280, margin: "0 auto" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => handlePin(String(n))} disabled={loading}
              style={{ padding: "20px", borderRadius: "50%", border: "none", background: "#F4F5F7", fontSize: 24, fontWeight: 700, cursor: "pointer" }}>
              {n}
            </button>
          ))}
          <div />
          <button onClick={() => handlePin("0")} disabled={loading}
            style={{ padding: "20px", borderRadius: "50%", border: "none", background: "#F4F5F7", fontSize: 24, fontWeight: 700, cursor: "pointer" }}>
            0
          </button>
          <button onClick={handleDelete} disabled={loading}
            style={{ padding: "20px", borderRadius: "50%", border: "none", background: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}
