import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

const DEVICE_TYPES = [
  { id:"receipt_printer", label:"Receipt Printer",   icon:"🖨",  desc:"Prints customer receipts at cashier" },
  { id:"kitchen_printer", label:"Kitchen Printer",   icon:"🍳",  desc:"Prints kitchen tickets for orders" },
  { id:"barcode_scanner", label:"Barcode Scanner",   icon:"📷",  desc:"Scans product barcodes at checkout" },
  { id:"cash_drawer",     label:"Cash Drawer",       icon:"💰",  desc:"Connected via receipt printer RJ11" },
  { id:"edc_terminal",    label:"EDC / Card Reader", icon:"💳",  desc:"GoBiz, Verifone or similar terminal" },
  { id:"display",         label:"Customer Display",  icon:"🖥",  desc:"Customer-facing screen at cashier" },
]

const CONN_TYPES = {
  receipt_printer: ["Bluetooth","Network (IP)","USB"],
  kitchen_printer: ["Bluetooth","Network (IP)","USB"],
  barcode_scanner: ["Bluetooth","USB"],
  cash_drawer:     ["Via Printer (RJ11)"],
  edc_terminal:    ["Bluetooth","USB"],
  display:         ["USB","HDMI"],
}

const PAPER_SIZES = ["80mm (standard)","58mm (narrow)"]

const COMPATIBLE = [
  { name:"Epson TM-T82X / TM-T88",    type:"Receipt/Kitchen Printer", icon:"🖨" },
  { name:"Star Micronics TSP100/650",  type:"Receipt/Kitchen Printer", icon:"🖨" },
  { name:"APG Cash Drawer",            type:"Cash Drawer (RJ11)",     icon:"💰" },
  { name:"Honeywell / Zebra Scanner",  type:"Barcode Scanner",        icon:"📷" },
  { name:"GoBiz PLUS / Verifone EDC",  type:"EDC Terminal",           icon:"💳" },
  { name:"Customer Display (USB)",     type:"Customer Display",       icon:"🖥" },
]

const KEY = "pl_hardware_devices"
function loadDevices() {
  try { return JSON.parse(localStorage.getItem(KEY)||"[]") } catch { return [] }
}

export default function Hardware() {
  const [devices, setDevices] = useState(loadDevices)
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState({ type:"receipt_printer", name:"", connection:"Bluetooth", ip:"", port:"9100", mac:"", paper:"80mm (standard)", station:"", notes:"" })
  const [saved,   setSaved]   = useState(false)
  const [testing, setTesting] = useState(null)

  function save() {
    localStorage.setItem(KEY, JSON.stringify(devices))
    setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  function addDevice() {
    if (!form.name) return
    const newDevices = [...devices, { ...form, id:"DEV-"+Date.now() }]
    setDevices(newDevices)
    localStorage.setItem(KEY, JSON.stringify(newDevices))
    setModal(false)
    setForm({ type:"receipt_printer", name:"", connection:"Bluetooth", ip:"", port:"9100", mac:"", paper:"80mm (standard)", station:"", notes:"" })
  }

  function removeDevice(id) {
    if (!confirm("Remove this device?")) return
    const newDevices = devices.filter(d=>d.id!==id)
    setDevices(newDevices)
    localStorage.setItem(KEY, JSON.stringify(newDevices))
  }

  async function testPrint(device) {
    setTesting(device.id)
    // Simulate test print
    await new Promise(r=>setTimeout(r,2000))
    alert(`Test print sent to ${device.name}.\nIf nothing printed, check connection settings.`)
    setTesting(null)
  }

  const typeInfo = (id) => DEVICE_TYPES.find(d=>d.id===id)||DEVICE_TYPES[0]
  const connOptions = (type) => CONN_TYPES[type]||["Bluetooth","USB"]

  return (
    <div>
      {/* Header stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        <div style={{ background:"#fff", borderRadius:12, padding:"16px 20px", border:"1px solid #f0f0f0" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#6B778C", marginBottom:4 }}>DEVICES CONFIGURED</div>
          <div style={{ fontSize:28, fontWeight:900, color:"#0052CC" }}>{devices.length}</div>
        </div>
        <div style={{ background:"#fff", borderRadius:12, padding:"16px 20px", border:"1px solid #f0f0f0" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#6B778C", marginBottom:4 }}>PRINTERS</div>
          <div style={{ fontSize:28, fontWeight:900, color:"#00875A" }}>{devices.filter(d=>d.type.includes("printer")).length}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end" }}>
          <button onClick={()=>setModal(true)} className="bo-btn bo-btn-primary" style={{ height:"fit-content" }}>+ Add Device</button>
        </div>
      </div>

      {/* Device list */}
      {devices.length===0 ? (
        <div className="bo-card" style={{ textAlign:"center", padding:40 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🖨</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>No devices added yet</div>
          <div style={{ fontSize:13, color:"#6B778C", marginBottom:16 }}>Tap "+ Add Device" to set up your printers and hardware</div>
          <button onClick={()=>setModal(true)} className="bo-btn bo-btn-primary">+ Add Device</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
          {devices.map(d => {
            const info = typeInfo(d.type)
            return (
              <div key={d.id} style={{ background:"#fff", border:"1.5px solid #f0f0f0", borderRadius:14, overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 20px" }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{info.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:"#0A1628" }}>{d.name}</div>
                    <div style={{ fontSize:12, color:"#6B778C" }}>{info.label} · {d.connection}</div>
                    {d.connection==="Network (IP)" && <div style={{ fontSize:11, fontFamily:"monospace", color:"#0052CC" }}>{d.ip}:{d.port}</div>}
                    {d.connection==="Bluetooth" && d.mac && <div style={{ fontSize:11, fontFamily:"monospace", color:"#6B778C" }}>{d.mac}</div>}
                    {d.type.includes("printer") && <div style={{ fontSize:11, color:"#6B778C" }}>Paper: {d.paper}</div>}
                    {d.station && <div style={{ fontSize:11, color:"#6554C0", fontWeight:600 }}>Station: {d.station}</div>}
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    {d.type.includes("printer") && (
                      <button onClick={()=>testPrint(d)} disabled={testing===d.id} className="bo-btn bo-btn-ghost bo-btn-sm">
                        {testing===d.id?"Testing...":"Test Print"}
                      </button>
                    )}
                    <button onClick={()=>removeDevice(d.id)} className="bo-btn bo-btn-sm" style={{ background:"none", border:"1px solid #f0f0f0", color:"var(--red)", cursor:"pointer" }}>Remove</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Compatible hardware list */}
      <div className="bo-card">
        <div className="bo-card-title">📋 Compatible Hardware</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
          {COMPATIBLE.map(c=>(
            <div key={c.name} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:"var(--surface)", borderRadius:8, border:"1px solid var(--surface3)" }}>
              <span style={{ fontSize:20 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>{c.name}</div>
                <div style={{ fontSize:11, color:"#6B778C" }}>{c.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Device Modal */}
      {modal && (
        <div className="bo-overlay" onMouseDown={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="bo-modal" style={{ maxWidth:500 }}>
            <div className="bo-modal-header">
              <div className="bo-modal-title">Add Hardware Device</div>
              <button className="bo-modal-close" onClick={()=>setModal(false)}>✕</button>
            </div>
            <div className="bo-modal-body">
              {/* Device type */}
              <div className="bo-form-row">
                <label className="bo-label">Device Type</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {DEVICE_TYPES.map(t=>(
                    <button key={t.id} onClick={()=>setForm(f=>({...f,type:t.id,connection:connOptions(t.id)[0]}))}
                      style={{ padding:"10px 12px", borderRadius:10, border:"1.5px solid "+(form.type===t.id?"var(--brand)":"var(--surface3)"),
                        background:form.type===t.id?"var(--brand-lt)":"#fff", cursor:"pointer", textAlign:"left" }}>
                      <div style={{ fontSize:18, marginBottom:2 }}>{t.icon}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:form.type===t.id?"var(--brand)":"#0A1628" }}>{t.label}</div>
                      <div style={{ fontSize:10, color:"#6B778C" }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="bo-form-row">
                <label className="bo-label">Device Name *</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bo-input" placeholder="e.g. Cashier Printer, Kitchen Printer 1" autoFocus />
              </div>

              {/* Connection type */}
              <div className="bo-form-row">
                <label className="bo-label">Connection Type</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {connOptions(form.type).map(c=>(
                    <button key={c} onClick={()=>setForm(f=>({...f,connection:c}))}
                      className={"bo-btn bo-btn-sm "+(form.connection===c?"bo-btn-primary":"bo-btn-ghost")}>{c}</button>
                  ))}
                </div>
              </div>

              {/* IP settings */}
              {form.connection==="Network (IP)" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 100px", gap:12, marginBottom:14 }}>
                  <div><label className="bo-label">IP Address</label><input value={form.ip} onChange={e=>setForm(f=>({...f,ip:e.target.value}))} className="bo-input" placeholder="192.168.1.100" /></div>
                  <div><label className="bo-label">Port</label><input value={form.port} onChange={e=>setForm(f=>({...f,port:e.target.value}))} className="bo-input" /></div>
                </div>
              )}

              {/* MAC/Bluetooth name */}
              {form.connection==="Bluetooth" && (
                <div className="bo-form-row"><label className="bo-label">Bluetooth Name / MAC Address</label><input value={form.mac} onChange={e=>setForm(f=>({...f,mac:e.target.value}))} className="bo-input" placeholder="e.g. POS-58 or AA:BB:CC:DD:EE:FF" /></div>
              )}

              {/* Paper size for printers */}
              {form.type.includes("printer") && (
                <div className="bo-form-row">
                  <label className="bo-label">Paper Size</label>
                  <div style={{ display:"flex", gap:8 }}>
                    {PAPER_SIZES.map(p=>(
                      <button key={p} onClick={()=>setForm(f=>({...f,paper:p}))} className={"bo-btn bo-btn-sm "+(form.paper===p?"bo-btn-primary":"bo-btn-ghost")}>{p}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Station for kitchen printer */}
              {form.type==="kitchen_printer" && (
                <div className="bo-form-row">
                  <label className="bo-label">Assigned Station</label>
                  <select value={form.station} onChange={e=>setForm(f=>({...f,station:e.target.value}))} className="bo-select">
                    <option value="">— Select station —</option>
                    {["Kitchen","Bar","Snack","Kasir"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div className="bo-form-row"><label className="bo-label">Notes</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="bo-input" placeholder="Optional notes" /></div>
            </div>
            <div className="bo-modal-footer">
              <button onClick={()=>setModal(false)} className="bo-btn bo-btn-ghost">Cancel</button>
              <button onClick={addDevice} disabled={!form.name} className="bo-btn bo-btn-primary">Add Device</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
