import { useState, useEffect, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import { KITCHEN_TICKET_DEFAULTS } from "./KitchenTicketDesigner"

const TYPE_CONFIG = {
  new:          { label:"NEW ORDER",    color:"#059669", bg:"#ECFDF5", border:"#6EE7B7" },
  addition:     { label:"ADDITIONAL",   color:"#2563EB", bg:"#EFF6FF", border:"#93C5FD" },
  cancellation: { label:"CANCEL ORDER", color:"#DC2626", bg:"#FEF2F2", border:"#FCA5A5" },
  update:       { label:"ORDER UPDATE", color:"#7C3AED", bg:"#F5F3FF", border:"#C4B5FD" },
  reprint:      { label:"REPRINT",      color:"#B45309", bg:"#FFFBEB", border:"#FCD34D" },
}

const STATION_ICONS = { Bar:"🔥", Kitchen:"🍳", Snack:"🍟" }
const DEFAULT_ICON  = "🍽️"

function resolveItems(raw) {
  if (!raw) return []
  if (typeof raw === "string") { try { return JSON.parse(raw) } catch { return [] } }
  return Array.isArray(raw) ? raw : []
}

function elapsed(createdAt) {
  const ms  = Date.now() - new Date(createdAt).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1)  return "Just now"
  if (min < 60) return min + "m ago"
  return Math.floor(min / 60) + "h " + (min % 60) + "m ago"
}

function TicketCard({ ticket, settings, onMarkDone }) {
  const cfg    = settings || KITCHEN_TICKET_DEFAULTS
  const type   = ticket.type || "new"
  const tc     = TYPE_CONFIG[type] || TYPE_CONFIG.new
  const done   = ticket.status === "Done" || ticket.status === "done"
  const colors = cfg.station_colors || KITCHEN_TICKET_DEFAULTS.station_colors
  const stationColor = colors[ticket.station] || "#6366F1"
  const icon   = STATION_ICONS[ticket.station] || DEFAULT_ICON
  const items  = resolveItems(ticket.items)

  const isCancel = type === "cancellation"
  const isAdd    = type === "addition"

  return (
    <div style={{
      background:    done ? "#F8FAFC" : "#fff",
      borderRadius:  14,
      padding:       "14px 14px 12px",
      boxShadow:     done ? "none" : "0 4px 20px rgba(0,0,0,0.10)",
      border:        `1.5px solid ${done ? "#E2E8F0" : tc.border + "60"}`,
      opacity:       done ? 0.55 : 1,
      transition:    "all 0.25s",
      fontFamily:    "'Courier New', Courier, monospace",
      fontSize:      11,
      lineHeight:    1.55,
      position:      "relative",
    }}>
      {/* Elapsed time chip */}
      <div style={{
        position:"absolute", top:10, right:10,
        fontSize:9, fontWeight:700, color:"#94A3B8",
        background:"#F1F5F9", borderRadius:8, padding:"2px 6px",
      }}>
        {elapsed(ticket.created_at)}
      </div>

      {/* Outlet name */}
      {cfg.show_outlet_name && cfg.outlet_name && (
        <div style={{ textAlign:"center", fontWeight:900, fontSize:12, letterSpacing:1, marginBottom:3 }}>
          {cfg.outlet_name}
        </div>
      )}

      {/* Station badge */}
      <div style={{ textAlign:"center", marginBottom:9 }}>
        <span style={{
          background:    done ? "#94A3B8" : stationColor,
          color:         "#fff",
          padding:       "4px 16px",
          borderRadius:  20,
          fontWeight:    700,
          fontSize:      11,
          letterSpacing: 0.5,
          display:       "inline-block",
        }}>
          {icon} {ticket.station || "KITCHEN"}
        </span>
      </div>

      {/* Order info */}
      <div style={{ borderTop:"1px dashed #D1D5DB", paddingTop:6, marginBottom:5 }}>
        {ticket.table && (
          <div style={{ fontWeight:800, fontSize:12 }}>{ticket.table}</div>
        )}
        <div style={{ color:"#9CA3AF", fontSize:10 }}>{ticket.time || "—"}</div>
      </div>

      {/* Items */}
      <div style={{ borderTop:"1px dashed #D1D5DB", padding:"6px 0 4px", minHeight:32 }}>
        {items.length === 0 && (
          <div style={{ color:"#9CA3AF", fontSize:10 }}>No items</div>
        )}
        {items.map((item, i) => {
          const qtyColor  = isCancel ? "#DC2626" : isAdd ? "#059669" : "#0A1628"
          const qtyPrefix = isCancel ? "−" : isAdd ? "+" : ""
          const mods = item.modifiers
            ? Object.values(item.modifiers).filter(Boolean)
            : []
          return (
            <div key={i} style={{ marginBottom:5 }}>
              <div style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
                <span style={{ fontWeight:900, color:qtyColor, minWidth:22, flexShrink:0 }}>
                  {qtyPrefix}{item.qty}×
                </span>
                <span style={{ fontWeight:700, color:"#0A1628", textTransform:"uppercase", flex:1 }}>
                  {item.name}
                </span>
              </div>
              {cfg.show_modifiers && mods.length > 0 && (
                <div style={{ paddingLeft:28, color:"#6B7280", fontSize:10 }}>
                  [{mods.join(", ")}]
                </div>
              )}
              {cfg.show_note && item.note && (
                <div style={{ paddingLeft:28, color:"#B45309", fontSize:10, fontStyle:"italic" }}>
                  ★ {item.note}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Type badge + Done button */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:6 }}>
        <span style={{
          background:  tc.bg,
          color:       tc.color,
          border:      `1.5px solid ${tc.border}`,
          padding:     "3px 12px",
          borderRadius:20,
          fontWeight:  800,
          fontSize:    9,
          letterSpacing:0.8,
        }}>
          {tc.label}
        </span>
        {done ? (
          <span style={{ fontSize:10, color:"#94A3B8", fontWeight:700 }}>✓ Done</span>
        ) : (
          <button onClick={() => onMarkDone(ticket.id)} style={{
            background:   "#0A1628",
            color:        "#fff",
            border:       "none",
            borderRadius: 8,
            padding:      "5px 12px",
            fontSize:     10,
            fontWeight:   700,
            cursor:       "pointer",
          }}>
            ✓ Done
          </button>
        )}
      </div>

      {/* Footer */}
      {cfg.show_footer && cfg.footer_text && (
        <div style={{
          textAlign:   "center",
          color:       "#9CA3AF",
          fontSize:    10,
          borderTop:   "1px dashed #E5E7EB",
          paddingTop:  5,
          marginTop:   4,
        }}>
          {cfg.footer_text}
        </div>
      )}
    </div>
  )
}

export default function KitchenDisplay() {
  const [tickets,   setTickets]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [station,   setStation]   = useState("all")
  const [showDone,  setShowDone]  = useState(false)
  const [settings,  setSettings]  = useState(null)
  const [lastPing,  setLastPing]  = useState(null)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    const since = new Date()
    since.setHours(since.getHours() - 18) // last 18 hours
    const { data } = await supabase
      .from("kitchen_tickets")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(120)
    setTickets(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // Load settings
    supabase.from("app_settings").select("kitchen_ticket").eq("id","main").maybeSingle()
      .then(({ data }) => setSettings(data?.kitchen_ticket || KITCHEN_TICKET_DEFAULTS))
    loadTickets()
  }, [loadTickets])

  // Realtime — new ticket comes in immediately as a new card
  useEffect(() => {
    const ch = supabase.channel("kitchen_display_rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"kitchen_tickets" }, payload => {
        setTickets(prev => [payload.new, ...prev])
        setLastPing(new Date())
      })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"kitchen_tickets" }, payload => {
        setTickets(prev => prev.map(t => t.id === payload.new.id ? payload.new : t))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function markDone(id) {
    await supabase.from("kitchen_tickets").update({ status:"Done" }).eq("id", id)
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status:"Done" } : t))
  }

  async function markAllDone(stationFilter) {
    const toMark = tickets.filter(t =>
      (t.status !== "Done" && t.status !== "done") &&
      (stationFilter === "all" || t.station === stationFilter)
    )
    await Promise.all(toMark.map(t =>
      supabase.from("kitchen_tickets").update({ status:"Done" }).eq("id", t.id)
    ))
    setTickets(prev => prev.map(t =>
      toMark.some(m => m.id === t.id) ? { ...t, status:"Done" } : t
    ))
  }

  // Unique stations from the loaded tickets
  const knownStations = [...new Set(tickets.map(t => t.station).filter(Boolean))]

  const filtered = tickets.filter(t => {
    const isDone = t.status === "Done" || t.status === "done"
    if (!showDone && isDone) return false
    if (station !== "all" && t.station !== station) return false
    return true
  })

  const pendingCount = (s) => tickets.filter(t =>
    (t.status !== "Done" && t.status !== "done") &&
    (s === "all" || t.station === s)
  ).length

  const totalPending = pendingCount("all")

  return (
    <div>
      {/* ── Toolbar ──────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {/* Station tabs */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["all", ...knownStations].map(s => {
            const cnt = pendingCount(s)
            return (
              <button key={s} onClick={() => setStation(s)}
                className={"bo-btn bo-btn-sm " + (station===s ? "bo-btn-primary" : "bo-btn-ghost")}
                style={{ display:"flex", alignItems:"center", gap:5 }}>
                {s === "all" ? "All Stations" : `${STATION_ICONS[s]||""} ${s}`}
                {cnt > 0 && (
                  <span style={{
                    background:"#DC2626", color:"#fff", borderRadius:20,
                    padding:"1px 6px", fontSize:9, fontWeight:800,
                  }}>{cnt}</span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {/* Live indicator */}
          <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#10B981" }}>
            <span style={{
              width:7, height:7, borderRadius:"50%", background:"#10B981",
              boxShadow:"0 0 0 2px #D1FAE5",
              animation:"pulse 2s infinite",
            }}/>
            Live
            {lastPing && (
              <span style={{ color:"#94A3B8", fontSize:10 }}>
                · last update {new Date(lastPing).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}
              </span>
            )}
          </div>

          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, cursor:"pointer", color:"var(--ink3)" }}>
            <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)}
              style={{ accentColor:"var(--brand)" }} />
            Show Done
          </label>

          {totalPending > 0 && (
            <button onClick={() => markAllDone(station)}
              className="bo-btn bo-btn-sm bo-btn-ghost"
              style={{ color:"#10B981", borderColor:"#10B981" }}>
              ✓ Mark All Done
            </button>
          )}

          <button onClick={loadTickets} className="bo-btn bo-btn-sm bo-btn-ghost" title="Reload">
            ↺
          </button>
        </div>
      </div>

      {/* ── Summary strip ────────────────────────────── */}
      {totalPending > 0 && (
        <div style={{
          background:"#FEF2F2", border:"1px solid #FCA5A5",
          borderRadius:10, padding:"8px 14px", marginBottom:14,
          display:"flex", alignItems:"center", gap:8, fontSize:12, fontWeight:700, color:"#DC2626",
        }}>
          <span>🔔</span>
          <span>{totalPending} pending ticket{totalPending>1?"s":""}</span>
          {knownStations.filter(s => pendingCount(s) > 0).map(s => (
            <span key={s} style={{
              background:"rgba(220,38,38,0.1)", borderRadius:8,
              padding:"2px 8px", fontSize:11,
            }}>
              {STATION_ICONS[s]||""} {s}: {pendingCount(s)}
            </span>
          ))}
        </div>
      )}

      {/* ── Ticket grid ──────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign:"center", padding:60, color:"var(--ink5)" }}>
          <div style={{ fontSize:24, marginBottom:8, animation:"pulse 1.5s infinite" }}>🎫</div>
          Loading tickets…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:60, color:"var(--ink5)" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>
            {showDone ? "No tickets" : "All tickets done!"}
          </div>
          <div style={{ fontSize:12 }}>
            {!showDone && "Enable "Show Done" to see completed tickets"}
          </div>
        </div>
      ) : (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))",
          gap:14,
          alignItems:"start",
        }}>
          {filtered.map(t => (
            <TicketCard key={t.id} ticket={t} settings={settings} onMarkDone={markDone} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1 }
          50%      { opacity:0.4 }
        }
      `}</style>
    </div>
  )
}
