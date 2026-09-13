import { useState, useRef, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function Attendance({ staff, onBack }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [status, setStatus] = useState(null) // null, 'in', 'out'
  const [step, setStep] = useState("init") // 'init', 'camera', 'uploading', 'done'
  const [actionType, setActionType] = useState("")
  const [debug, setDebug] = useState("") // 'clock_in', 'clock_out'
  const [location, setLocation] = useState(null)
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)

  useEffect(() => {
    checkStatus()
    return () => stopCamera()
  }, [])

  async function checkStatus() {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0,10)
      const attId = "ATT-"+staff.name.replace(/\s/g,"")+"-"+today
      const { data } = await supabase.from("attendance").select("*").eq("id", attId).maybeSingle()
      if (!data) {
        setStatus("out")
      } else if (data.clock_in && !data.clock_out) {
        setStatus("in")
      } else {
        setStatus("done")
      }
    } catch (e) {
      setError("Failed to load attendance status")
    }
    setLoading(false)
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
    }
  }

    useEffect(() => {
    if (step === "camera" && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
         setDebug(prev => prev + " | Metadata loaded");
         videoRef.current.play().then(() => setDebug(prev => prev + " | Playing")).catch(e => setDebug(prev => prev + " | Play err: " + e.message));
      };
    }
  }, [step, stream]);

const startProcess = async (type) => {
    setActionType(type)
    setError("")
    setStep("camera")
    
    // 1. Check Geofence Settings First
    const isOwner = staff?.role?.toLowerCase() === "owner" || staff?.role?.toLowerCase() === "admin";
    try {
      const { data: settings } = await supabase.from('app_settings').select('store_lat, store_lng, store_radius_meters').eq('id', 'main').single()
      
      if (!isOwner && settings && settings.store_lat && settings.store_lng) {
        // Location is required for regular staff
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000 })
          })
          const { latitude, longitude } = pos.coords
          setLocation({ lat: latitude, lng: longitude })
          
          const dist = getDistance(latitude, longitude, settings.store_lat, settings.store_lng)
          const radius = settings.store_radius_meters || 50
          if (dist > radius) {
            setError(`You are ${Math.round(dist)}m away from the store. You must be within ${radius}m to clock in/out.`)
            setStep("init")
            return
          }
        } catch(e) {
          if (e.code === 1) {
            setError("Location access denied. Please check your browser AND device settings (e.g. iOS Settings > Privacy > Location).")
          } else if (e.code === 3) {
            setError("Location request timed out. Ensure your GPS is on and try stepping outside.")
          } else {
            setError("Location error: " + (e.message || "Unknown error"))
          }
          setStep("init")
          return
        }
      }
    } catch (e) {
      console.warn("Failed to check app_settings for geofence", e)
    }

    // 2. Start Camera
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      setStream(mediaStream)
      
    } catch (e) {
      setError("Failed to access camera. Please allow camera access.")
      setStep("init")
    }
  }

  const takePhotoAndSubmit = async () => {
    if (!videoRef.current || !canvasRef.current) return
    setStep("uploading")
    
    // Draw to canvas
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    
    stopCamera()

    // Get blob
    canvas.toBlob(async (blob) => {
      try {
        const today = new Date().toISOString().slice(0,10)
        const nowIso = new Date().toISOString()
        const attId = "ATT-"+staff.name.replace(/\s/g,"")+"-"+today
        const fileName = `${attId}-${actionType}-${Date.now()}.jpg`
        
        // Upload photo
        const { data: uploadData, error: uploadErr } = await supabase.storage.from("attendance-photos").upload(fileName, blob, { contentType: "image/jpeg" })
        if (uploadErr) throw uploadErr
        
        const photoUrl = supabase.storage.from("attendance-photos").getPublicUrl(fileName).data.publicUrl

        // Update DB
        if (actionType === "clock_in") {
          await supabase.from("attendance").upsert({ 
            id: attId, 
            staff_name: staff.name, 
            date: today, 
            clock_in: nowIso, 
            status: "on_time",
            clock_in_photo: photoUrl,
            clock_in_lat: location?.lat,
            clock_in_lng: location?.lng
          })
        } else {
          await supabase.from("attendance").update({ 
            clock_out: nowIso,
            clock_out_photo: photoUrl,
            clock_out_lat: location?.lat,
            clock_out_lng: location?.lng
          }).eq("id", attId)
        }
        
        setStep("done")
        checkStatus()
      } catch (e) {
        setError("Failed to submit attendance: " + e.message)
        setStep("init")
      }
    }, "image/jpeg", 0.8)
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f5f6fa" }}>
      <div style={{ padding: "16px 20px", background: "#fff", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Attendance</div>
          <div style={{ fontSize: 13, color: "#666" }}>{staff.name}</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        
        {error && <div style={{ background: "#FFEBE6", color: "#DE350B", padding: "12px 16px", borderRadius: 8, marginBottom: 24, fontWeight: 600, width: "100%", maxWidth: 400 }}>{error}</div>}

        {step === "init" && (
          <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{status === "out" ? "👋" : status === "in" ? "🏃" : "🎉"}</div>
            <h2 style={{ margin: "0 0 8px 0" }}>
              {status === "out" ? "Ready to start?" : status === "in" ? "Finished your shift?" : "All done for today!"}
            </h2>
            <p style={{ color: "#666", marginBottom: 32 }}>
              {status === "out" ? "Make sure you are at the store to clock in." : status === "in" ? "Clock out when you're ready to leave." : "You have already clocked in and out today."}
            </p>

            {status === "out" && (
              <button onClick={() => startProcess("clock_in")} style={{ width: "100%", padding: 16, background: "#00875A", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                Clock In
              </button>
            )}
            {status === "in" && (
              <button onClick={() => startProcess("clock_out")} style={{ width: "100%", padding: 16, background: "#DE350B", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                Clock Out
              </button>
            )}
            {status === "done" && (
              <button onClick={onBack} style={{ width: "100%", padding: 16, background: "#E8ECF0", color: "#111", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                Back to Home
              </button>
            )}
          </div>
        )}

        {step === "camera" && (
          <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#000", borderRadius: 16, overflow: "hidden", position: "relative", aspectRatio: "3/4" }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", top: 10, left: 10, right: 10, color: "lime", fontSize: 12, background: "rgba(0,0,0,0.8)", padding: 4, zIndex: 100 }}>{debug}</div>
              <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center" }}>
                <div style={{ display: "inline-block", background: "rgba(0,0,0,0.5)", color: "#fff", padding: "8px 16px", borderRadius: 20, fontSize: 14 }}>
                  Please take a clear selfie
                </div>
              </div>
            </div>
            <button onClick={takePhotoAndSubmit} style={{ width: "100%", padding: 16, background: "#0066FF", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              Capture & Submit
            </button>
            <button onClick={() => { stopCamera(); setStep("init") }} style={{ width: "100%", padding: 16, background: "transparent", color: "#666", border: "none", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}

        {step === "uploading" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Uploading & Verifying...</div>
          </div>
        )}

        {/* Hidden canvas for image capture */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  )
}
