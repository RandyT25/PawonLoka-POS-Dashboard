import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

export const KITCHEN_TICKET_DEFAULTS = {
  outlet_name:       "PawonLoka",
  show_outlet_name:  true,
  show_order_id:     true,
  show_table:        true,
  show_order_type:   true,
  show_pax:          false,
  show_datetime:     true,
  show_modifiers:    true,
  show_note:         true,
  show_footer:       true,
  footer_text:       "Terima kasih ♥",
  paper_size:        "80mm",
  station_colors: {
    Bar:     "#F97316",
    Kitchen: "#1D4ED8",
    Snack:   "#059669",
  },
}

const TYPE_CONFIG = {
  new:          { label:"NEW ORDER",    color:"#059669", bg:"#ECFDF5", border:"#6EE7B7" },
  addition:     { label:"ADDITIONAL",   color:"#2563EB", bg:"#EFF6FF", border:"#93C5FD" },
  cancellation: { label:"CANCEL ORDER", color:"#DC2626", bg:"#FEF2F2", border:"#FCA5A5" },
  reprint:      { label:"REPRINT",      color:"#B45309", bg:"#FFFBEB", border:"#FCD34D" },
}

const STATION_ICONS = { Bar:"🔥", Kitchen:"🍳", Snack:"🍟", Default:"🍽️" }

const SAMPLES = {
  new: {
    type:"new", station:"BAR", orderId:"ORD-A271",
    table:"TABLE 12", orderType:"DINE IN", pax:4,
    time:"19:31 | 17 Jun 2026",
    items:[
      { name:"WEDANG UWUH", qty:1, prefix:"",  mods:"Less Sugar, No Ice", note:"" },
      { name:"ES JERUK",    qty:1, prefix:"",  mods:"Less Sugar",         note:"" },
      { name:"NASI GORENG", qty:1, prefix:"",  mods:"Telur Dadar",        note:"Pedas Sedang" },
    ],
  },
  addition: {
    type:"addition", station:"BAR", orderId:"ORD-A271",
    table:"TABLE 12", orderType:"DINE IN", pax:null,
    time:"19:45 | 17 Jun 2026",
    items:[
      { name:"WEDANG UWUH",  qty:1, prefix:"+", mods:"Less Sugar, No Ice", note:"" },
      { name:"ES TEH MANIS", qty:2, prefix:"+", mods:"Extra Ice",           note:"" },
    ],
  },
  cancellation: {
    type:"cancellation", station:"BAR", orderId:"ORD-A271",
    table:"TABLE 12", orderType:"DINE IN", pax:null,
    time:"19:50 | 17 Jun 2026",
    items:[
      { name:"WEDANG UWUH", qty:1, prefix:"-", mods:"Less Sugar, No Ice", note:"" },
      { name:"ES JERUK",    qty:2, prefix:"-", mods:"Extra Ice",          note:"Batalkan karena telah dibuat" },
    ],
  },
  reprint: {
    type:"reprint", station:"KITCHEN", orderId:"ORD-A271",
    table:"TABLE 12", orderType:"DINE IN", pax:null,
    time:"19:45 | 17 Jun 2026",
    items:[
      { name:"AYAM TALIWANG", qty:1, prefix:"", mods:"Pedas, Tanpa Bawang",   note:"" },
      { name:"SOTO AYAM",     qty:1, prefix:"", mods:"Tanpa Daun Bawang",     note:"" },
      { name:"NASI PUTIH",    qty:1, prefix:"", mods:"",                       note:"" },
    ],
  },
}

function TicketPreview({ sample, s }) {
  const tc = TYPE_CONFIG[sample.type] || TYPE_CONFIG.new
  const colors = s.station_colors || KITCHEN_TICKET_DEFAULTS.station_colors
  const stationColor = colors[sample.station] || "#6366F1"
  const icon = STATION_ICONS[sample.station] || STATION_ICONS.Default
  const w = s.paper_size === "58mm" ? 196 : 234

  const metaParts = [
    s.show_order_type && sample.orderType,
    s.show_table && sample.table,
    s.show_pax && sample.pax && `PAX: ${sample.pax}`,
  ].filter(Boolean)

  return (
    <div style={{
      background:"#fff", borderRadius:14, padding:"14px 14px 12px",
      boxShadow:"0 4px 20px rgba(0,0,0,0.12)", width:w, flexShrink:0,
      fontFamily:"'Courier New', Courier, monospace", fontSize:11, lineHeight:1.55,
      border:`1.5px solid ${tc.border}40`,
    }}>
      {/* Outlet */}
      {s.show_outlet_name && (
        <div style={{ textAlign:"center", fontWeight:900, fontSize:13, letterSpacing:1, marginBottom:3 }}>
          {s.outlet_name || "PawonLoka"}
        </div>
      )}

      {/* Station badge */}
      <div style={{ textAlign:"center", marginBottom:10 }}>
        <span style={{
          background:stationColor, color:"#fff", padding:"4px 16px",
          borderRadius:20, fontWeight:700, fontSize:11, letterSpacing:0.5,
          display:"inline-block",
        }}>
          {icon} {sample.station}
        </span>
      </div>

      {/* Order info */}
      <div style={{ borderTop:"1px dashed #D1D5DB", paddingTop:7, marginBottom:5 }}>
        {s.show_order_id && (
          <div style={{ fontWeight:900, fontSize:13 }}>{sample.orderId}</div>
        )}
        {metaParts.length > 0 && (
          <div style={{ color:"#6B7280", fontSize:10, fontWeight:600, marginTop:1 }}>
            {metaParts.join(" · ")}
          </div>
        )}
        {s.show_datetime && (
          <div style={{ color:"#9CA3AF", fontSize:10, marginTop:1 }}>{sample.time}</div>
        )}
      </div>

      {/* Items */}
      <div style={{ borderTop:"1px dashed #D1D5DB", padding:"7px 0 4px" }}>
        {sample.items.map((item, i) => {
          const qtyColor = item.prefix === "-" ? "#DC2626" : item.prefix === "+" ? "#059669" : "#0A1628"
          return (
            <div key={i} style={{ marginBottom:5 }}>
              <div style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
                <span style={{ fontWeight:900, color:qtyColor, minWidth:24, flexShrink:0 }}>
                  {item.prefix}{item.qty}×
                </span>
                <span style={{ fontWeight:700, color:"#0A1628", flex:1, textTransform:"uppercase" }}>
                  {item.name}
                </span>
              </div>
              {s.show_modifiers && item.mods && (
                <div style={{ paddingLeft:30, color:"#6B7280", fontSize:10 }}>[{item.mods}]</div>
              )}
              {s.show_note && item.note && (
                <div style={{ paddingLeft:30, color:"#B45309", fontSize:10, fontStyle:"italic" }}>★ {item.note}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Type badge */}
      <div style={{ display:"flex", justifyContent:"center", margin:"6px 0 4px" }}>
        <span style={{
          background:tc.bg, color:tc.color,
          border:`1.5px solid ${tc.border}`,
          padding:"4px 18px", borderRadius:20,
          fontWeight:800, fontSize:10, letterSpacing:0.8,
        }}>
          {tc.label}
        </span>
      </div>

      {/* Footer */}
      {s.show_footer && s.footer_text && (
        <div style={{ textAlign:"center", color:"#9CA3AF", fontSize:10, borderTop:"1px dashed #E5E7EB", paddingTop:5, marginTop:2 }}>
          {s.footer_text}
        </div>
      )}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={onChange} style={{
      width:40, height:22, borderRadius:11,
      background:checked?"var(--green, #10B981)":"var(--surface3, #E2E8F0)",
      position:"relative", cursor:"pointer", flexShrink:0, transition:"background 0.2s",
    }}>
      <div style={{
        width:18, height:18, borderRadius:"50%", background:"#fff",
        position:"absolute", top:2, left:checked?20:2, transition:"left 0.2s",
        boxShadow:"0 1px 4px rgba(0,0,0,0.2)",
      }} />
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="bo-form-row">
      <label className="bo-label">{label}</label>
      {children}
    </div>
  )
}

export default function KitchenTicketDesigner() {
  const [s,        setS]        = useState(KITCHEN_TICKET_DEFAULTS)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [preview,  setPreview]  = useState("new")

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("app_settings").select("kitchen_ticket,outlet").eq("id","main").maybeSingle()
    if (data?.kitchen_ticket) {
      setS({ ...KITCHEN_TICKET_DEFAULTS, ...data.kitchen_ticket,
        station_colors: { ...KITCHEN_TICKET_DEFAULTS.station_colors, ...(data.kitchen_ticket.station_colors||{}) }
      })
    } else if (data?.outlet?.name) {
      setS(p => ({ ...p, outlet_name: data.outlet.name }))
    }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from("app_settings").upsert({ id:"main", kitchen_ticket:s, updated_at:new Date().toISOString() })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const set  = (k, v)          => setS(p => ({ ...p, [k]: v }))
  const setC = (station, color) => setS(p => ({ ...p, station_colors:{ ...(p.station_colors||{}), [station]:color } }))

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--ink5)" }}>Loading...</div>

  const sampleTicket = { ...SAMPLES[preview], station: preview === "reprint" ? "KITCHEN" : "BAR" }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 270px", gap:20, alignItems:"start" }}>

      {/* ── Left: Settings ──────────────────────────── */}
      <div>

        {/* Content */}
        <div className="bo-card">
          <div className="bo-card-title">Ticket Content</div>

          <Field label="Outlet Name">
            <input value={s.outlet_name||""} onChange={e=>set("outlet_name",e.target.value)} className="bo-input" />
          </Field>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
            {[
              ["show_outlet_name", "Show Outlet Name"],
              ["show_order_id",    "Show Order ID"],
              ["show_table",       "Show Table Number"],
              ["show_order_type",  "Show Order Type (Dine-in / Takeaway)"],
              ["show_pax",         "Show PAX / Guest Count"],
              ["show_datetime",    "Show Date & Time"],
              ["show_modifiers",   "Show Item Modifiers"],
              ["show_note",        "Show Item Notes"],
            ].map(([k, label]) => (
              <label key={k} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13 }}>
                <input type="checkbox" checked={!!s[k]} onChange={e=>set(k,e.target.checked)}
                  style={{ accentColor:"var(--brand)", width:15, height:15 }} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bo-card">
          <div className="bo-card-title">Footer</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600 }}>Show Footer Text</span>
            <Toggle checked={!!s.show_footer} onChange={()=>set("show_footer",!s.show_footer)} />
          </div>
          {s.show_footer && (
            <Field label="Footer Message">
              <input value={s.footer_text||""} onChange={e=>set("footer_text",e.target.value)}
                className="bo-input" placeholder="Terima kasih ♥" />
            </Field>
          )}
        </div>

        {/* Station Colors */}
        <div className="bo-card">
          <div className="bo-card-title">Station Badge Colors</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
            {[
              ["Bar",     "🔥 Bar / Minuman"],
              ["Kitchen", "🍳 Kitchen / Dapur"],
              ["Snack",   "🍟 Snack / Gorengan"],
            ].map(([station, label]) => {
              const color = (s.station_colors||{})[station] || KITCHEN_TICKET_DEFAULTS.station_colors[station]
              return (
                <div key={station}>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--ink4)", marginBottom:8 }}>{label}</div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <input type="color" value={color}
                      onChange={e=>setC(station, e.target.value)}
                      style={{ width:40, height:40, borderRadius:10, border:"2px solid var(--surface3)", cursor:"pointer", padding:3 }} />
                    <div>
                      <div style={{ width:56, height:24, borderRadius:12, background:color, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ color:"#fff", fontSize:10, fontWeight:700 }}>{station}</span>
                      </div>
                      <div style={{ fontSize:10, color:"var(--ink5)", marginTop:2 }}>{color}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Print options */}
        <div className="bo-card">
          <div className="bo-card-title">Print Options</div>
          <Field label="Paper Size">
            <div style={{ display:"flex", gap:8 }}>
              {["80mm","58mm"].map(v => (
                <button key={v} onClick={()=>set("paper_size",v)}
                  className={"bo-btn bo-btn-sm "+(s.paper_size===v?"bo-btn-primary":"bo-btn-ghost")}>
                  {v==="80mm"?"80mm (standard)":"58mm (narrow)"}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Save */}
        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button onClick={save} disabled={saving} className="bo-btn bo-btn-primary" style={{ minWidth:180 }}>
            {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Ticket Settings"}
          </button>
        </div>
      </div>

      {/* ── Right: Preview ───────────────────────────── */}
      <div style={{ position:"sticky", top:16 }}>
        <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"8px 12px", background:"var(--surface)", borderBottom:"1px solid var(--surface3)", fontSize:12, fontWeight:700, color:"var(--ink4)" }}>
            LIVE PREVIEW
          </div>

          {/* Ticket type tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid var(--surface3)", background:"var(--surface)" }}>
            {[
              ["new",          "New"],
              ["addition",     "Add"],
              ["cancellation", "Cancel"],
              ["reprint",      "Reprint"],
            ].map(([type, label]) => (
              <button key={type} onClick={()=>setPreview(type)} style={{
                flex:1, padding:"8px 4px", border:"none", cursor:"pointer", fontSize:10, fontWeight:700,
                background: preview===type ? "#fff" : "transparent",
                borderBottom: preview===type ? "2px solid var(--brand)" : "2px solid transparent",
                color: preview===type ? "var(--brand)" : "var(--ink4)",
                marginBottom:-1, transition:"color 0.15s",
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Ticket card */}
          <div style={{ padding:16, background:"#F1F5F9", display:"flex", justifyContent:"center", minHeight:300 }}>
            <TicketPreview sample={sampleTicket} s={s} />
          </div>

          {/* Type color legend */}
          <div style={{ padding:"8px 12px", borderTop:"1px solid var(--surface3)", display:"flex", gap:6, flexWrap:"wrap" }}>
            {Object.entries(TYPE_CONFIG).map(([type, tc]) => (
              <span key={type} style={{ background:tc.bg, color:tc.color, border:`1px solid ${tc.border}`, padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700 }}>
                {tc.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
