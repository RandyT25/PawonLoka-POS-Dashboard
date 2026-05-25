import { useState, useEffect, useRef } from "react"
import { supabase } from "../../lib/supabase"

const KEY = "pl_receipt_settings"
const DEFAULTS = {
  show_logo:true, logo_color:"", logo_bw:"",
  outlet_name:"PawonLoka", tagline:"Rasa yang lahir dari dapur penuh cerita",
  address:"Bali, Indonesia", phone:"", website:"", social:"@pawonloka",
  footer_thank_you:"Terima kasih telah berkunjung!", footer_promo:"", footer_wifi:"",
  custom_line_1:"", custom_line_2:"",
  show_order_id:true, show_cashier:true, show_table:true, show_datetime:true,
  show_sku:false, show_tax:true, show_service:true, show_loyalty:true, show_qr:false,
  paper_size:"80mm", print_copies:1
}

function imgToBlackWhite(dataUrl) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width; canvas.height = img.height
      const ctx = canvas.getContext("2d")
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
      for (let i=0; i<d.data.length; i+=4) {
        const avg = (d.data[i]+d.data[i+1]+d.data[i+2])/3
        const bw = avg > 128 ? 255 : 0
        d.data[i]=d.data[i+1]=d.data[i+2]=bw
      }
      ctx.putImageData(d, 0, 0)
      resolve(canvas.toDataURL("image/png"))
    }
    img.src = dataUrl
  })
}

export default function ReceiptDesigner() {
  const [s,        setS]        = useState(DEFAULTS)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [uploading,setUploading]= useState("")
  const colorRef = useRef(null)
  const bwRef    = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("app_settings").select("receipt").eq("id","main").maybeSingle()
    if (data?.receipt) setS({ ...DEFAULTS, ...data.receipt })
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from("app_settings").upsert({ id:"main", receipt:s, updated_at:new Date().toISOString() })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function update(k, v) { setS(p => ({ ...p, [k]: v })) }

  async function uploadLogo(file, type) {
    if (!file) return
    if (file.size > 512000) { alert("Max 500KB"); return }
    setUploading(type)
    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target.result
      if (type==="color") {
        // Also auto-generate B&W version
        const bw = await imgToBlackWhite(dataUrl)
        // Upload both to Supabase storage
        const colorBlob = await fetch(dataUrl).then(r=>r.blob())
        const bwBlob    = await fetch(bw).then(r=>r.blob())
        await supabase.storage.from("logos").upload("logo-color.png", colorBlob, { upsert:true, contentType:"image/png" })
        await supabase.storage.from("logos").upload("logo-bw.png",    bwBlob,    { upsert:true, contentType:"image/png" })
        const { data:c } = supabase.storage.from("logos").getPublicUrl("logo-color.png")
        const { data:b } = supabase.storage.from("logos").getPublicUrl("logo-bw.png")
        setS(p => ({ ...p, logo_color: c.publicUrl+"?t="+Date.now(), logo_bw: b.publicUrl+"?t="+Date.now() }))
      } else {
        const bwBlob = await fetch(dataUrl).then(r=>r.blob())
        await supabase.storage.from("logos").upload("logo-bw.png", bwBlob, { upsert:true, contentType:"image/png" })
        const { data:b } = supabase.storage.from("logos").getPublicUrl("logo-bw.png")
        setS(p => ({ ...p, logo_bw: b.publicUrl+"?t="+Date.now() }))
      }
      setUploading("")
    }
    reader.readAsDataURL(file)
  }

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>

  return (
    <div className="receipt-grid" style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20, alignItems:"start" }}>

      {/* Left: Settings */}
      <div>
        {/* Logo */}
        <div className="bo-card">
          <div className="bo-card-title">Header</div>
          <label style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, cursor:"pointer" }}>
            <span style={{ fontSize:13, fontWeight:600 }}>Show Logo</span>
            <div onClick={()=>update("show_logo",!s.show_logo)}
              style={{ width:44,height:24,borderRadius:12,background:s.show_logo?"var(--green)":"var(--surface3)",position:"relative",cursor:"pointer",transition:"background 0.2s" }}>
              <div style={{ width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:s.show_logo?22:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
          </label>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
            {/* Color logo */}
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--ink4)", marginBottom:8 }}>Color Logo (email & digital)</div>
              {s.logo_color ? (
                <div style={{ position:"relative", marginBottom:8 }}>
                  <img src={s.logo_color} style={{ width:"100%", height:100, objectFit:"contain", borderRadius:8, background:"#f0f0f0", border:"1px solid var(--surface3)" }} />
                  <button onClick={()=>update("logo_color","")} style={{ position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",borderRadius:12,padding:"2px 8px",fontSize:11,cursor:"pointer" }}>Remove</button>
                </div>
              ) : (
                <div style={{ height:100, border:"2px dashed var(--surface3)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8, background:"#fafafa" }}>
                  <span style={{ fontSize:12, color:"var(--ink5)" }}>No logo</span>
                </div>
              )}
              <label style={{ display:"block", cursor:"pointer" }}>
                <div className="bo-btn bo-btn-ghost bo-btn-sm" style={{ textAlign:"center", width:"100%", boxSizing:"border-box" }}>
                  {uploading==="color"?"Uploading...":"⬆ Upload Color"}
                </div>
                <input ref={colorRef} type="file" accept="image/png,image/webp,image/jpeg" style={{ display:"none" }}
                  onChange={e=>uploadLogo(e.target.files[0],"color")} />
              </label>
              <div style={{ fontSize:10, color:"var(--ink5)", marginTop:4 }}>PNG/WebP, max 500KB. Auto-generates B&W version.</div>
            </div>

            {/* B&W logo */}
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--ink4)", marginBottom:8 }}>B&W Logo (printed receipts)</div>
              {s.logo_bw ? (
                <div style={{ position:"relative", marginBottom:8 }}>
                  <img src={s.logo_bw} style={{ width:"100%", height:100, objectFit:"contain", borderRadius:8, background:"#f0f0f0", border:"1px solid var(--surface3)" }} />
                  <button onClick={()=>update("logo_bw","")} style={{ position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",borderRadius:12,padding:"2px 8px",fontSize:11,cursor:"pointer" }}>Remove</button>
                </div>
              ) : (
                <div style={{ height:100, border:"2px dashed var(--surface3)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8, background:"#fafafa" }}>
                  <span style={{ fontSize:12, color:"var(--ink5)" }}>Auto-generated from color</span>
                </div>
              )}
              <label style={{ display:"block", cursor:"pointer" }}>
                <div className="bo-btn bo-btn-ghost bo-btn-sm" style={{ textAlign:"center", width:"100%", boxSizing:"border-box" }}>
                  {uploading==="bw"?"Uploading...":"⬆ Upload B&W"}
                </div>
                <input ref={bwRef} type="file" accept="image/png,image/webp" style={{ display:"none" }}
                  onChange={e=>uploadLogo(e.target.files[0],"bw")} />
              </label>
            </div>
          </div>

          {[["outlet_name","Outlet Name"],["tagline","Tagline"],["address","Address"],["phone","Phone"],["website","Website"],["social","Social Media"]].map(([k,l])=>(
            <div key={k} className="bo-form-row">
              <label className="bo-label">{l}</label>
              <input value={s[k]||""} onChange={e=>update(k,e.target.value)} className="bo-input" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bo-card">
          <div className="bo-card-title">Footer</div>
          {[["footer_thank_you","Thank you message"],["footer_promo","Promo message"],["footer_wifi","WiFi info"],["custom_line_1","Custom line 1"],["custom_line_2","Custom line 2"]].map(([k,l])=>(
            <div key={k} className="bo-form-row">
              <label className="bo-label">{l}</label>
              <input value={s[k]||""} onChange={e=>update(k,e.target.value)} className="bo-input" />
            </div>
          ))}
        </div>

        {/* Print options */}
        <div className="bo-card">
          <div className="bo-card-title">Print Options</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
            {[["show_order_id","Show Order ID"],["show_cashier","Show Cashier Name"],["show_table","Show Table"],["show_datetime","Show Date & Time"],["show_sku","Show Item SKU"],["show_tax","Show Tax Breakdown"],["show_service","Show Service Charge"],["show_loyalty","Show Loyalty Points"],["show_qr","Show QR Code"]].map(([k,l])=>(
              <label key={k} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13 }}>
                <input type="checkbox" checked={!!s[k]} onChange={e=>update(k,e.target.checked)} style={{ accentColor:"var(--brand)", width:15, height:15 }} />
                {l}
              </label>
            ))}
          </div>
          <div className="bo-form-row">
            <label className="bo-label">Paper Size</label>
            <div style={{ display:"flex", gap:8 }}>
              {["80mm","58mm"].map(v=><button key={v} onClick={()=>update("paper_size",v)} className={"bo-btn bo-btn-sm "+(s.paper_size===v?"bo-btn-primary":"bo-btn-ghost")}>{v==="80mm"?"80mm (standard)":"58mm (narrow)"}</button>)}
            </div>
          </div>
          <div className="bo-form-row">
            <label className="bo-label">Print Copies</label>
            <div style={{ display:"flex", gap:8 }}>
              {[1,2,3].map(v=><button key={v} onClick={()=>update("print_copies",v)} className={"bo-btn bo-btn-sm "+(s.print_copies===v?"bo-btn-primary":"bo-btn-ghost")}>{v} {v===1?"copy":"copies"}</button>)}
            </div>
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button onClick={save} disabled={saving} className="bo-btn bo-btn-primary" style={{ minWidth:160 }}>
            {saving?"Saving...":saved?"✓ Saved!":"Save Receipt Settings"}
          </button>
        </div>
      </div>

      {/* Right: Preview */}
      <div style={{ position:"sticky", top:16 }} className="receipt-preview-panel">
        <div className="bo-card" style={{ padding:0, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <div style={{ padding:"8px 12px", background:"var(--surface)", borderBottom:"1px solid var(--surface3)", fontSize:12, fontWeight:700, color:"var(--ink4)" }}>
            RECEIPT PREVIEW ({s.paper_size})
          </div>
          <div style={{ padding:16, fontFamily:"monospace", fontSize:11, lineHeight:1.6, maxWidth: s.paper_size==="58mm"?180:280, margin:"0 auto" }}>
            {s.show_logo && s.logo_bw && <div style={{ textAlign:"center", marginBottom:8 }}><img src={s.logo_bw} style={{ width:60, height:60, objectFit:"contain", filter:"grayscale(100%)" }} /></div>}
            <div style={{ textAlign:"center", fontWeight:700, fontSize:13 }}>{s.outlet_name}</div>
            {s.tagline && <div style={{ textAlign:"center", fontSize:10 }}>{s.tagline}</div>}
            {s.address && <div style={{ textAlign:"center", fontSize:10 }}>{s.address}</div>}
            {s.phone && <div style={{ textAlign:"center", fontSize:10 }}>{s.phone}</div>}
            {s.website && <div style={{ textAlign:"center", fontSize:10 }}>{s.website}</div>}
            <div style={{ borderTop:"1px dashed #ccc", margin:"8px 0" }} />
            {s.show_order_id && <div style={{ display:"flex", justifyContent:"space-between" }}><span>Order #</span><span>#1001</span></div>}
            {s.show_datetime && <div style={{ display:"flex", justifyContent:"space-between" }}><span>Date</span><span>22/05/2026 10:30</span></div>}
            {s.show_cashier && <div style={{ display:"flex", justifyContent:"space-between" }}><span>Cashier</span><span>Nita</span></div>}
            {s.show_table && <div style={{ display:"flex", justifyContent:"space-between" }}><span>Table</span><span>Table 3</span></div>}
            <div style={{ borderTop:"1px dashed #ccc", margin:"8px 0" }} />
            <div style={{ display:"flex", justifyContent:"space-between" }}><span>Nasi Goreng x1</span><span>Rp 25.000</span></div>
            <div style={{ display:"flex", justifyContent:"space-between" }}><span>Teh Manis x2</span><span>Rp 14.000</span></div>
            <div style={{ borderTop:"1px dashed #ccc", margin:"8px 0" }} />
            {s.show_tax && <div style={{ display:"flex", justifyContent:"space-between" }}><span>Tax 10%</span><span>Rp 3.900</span></div>}
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700 }}><span>TOTAL</span><span>Rp 42.900</span></div>
            <div style={{ borderTop:"1px dashed #ccc", margin:"8px 0" }} />
            {s.footer_thank_you && <div style={{ textAlign:"center", fontSize:10 }}>{s.footer_thank_you}</div>}
            {s.footer_promo && <div style={{ textAlign:"center", fontSize:10 }}>{s.footer_promo}</div>}
            {s.footer_wifi && <div style={{ textAlign:"center", fontSize:10 }}>WiFi: {s.footer_wifi}</div>}
            {s.social && <div style={{ textAlign:"center", fontSize:10 }}>{s.social}</div>}
            {s.custom_line_1 && <div style={{ textAlign:"center", fontSize:10 }}>{s.custom_line_1}</div>}
            {s.custom_line_2 && <div style={{ textAlign:"center", fontSize:10 }}>{s.custom_line_2}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
