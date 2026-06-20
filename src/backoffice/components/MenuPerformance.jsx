import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "../../lib/supabase"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"

const fmt  = n  => "Rp " + Number(n || 0).toLocaleString("id-ID")
const fmtK = n  => n >= 1_000_000 ? "Rp " + (n / 1_000_000).toFixed(1) + " jt"
                 : n >= 1_000     ? "Rp " + Math.round(n / 1_000) + " rb"
                 : fmt(n)

const RANK_COLORS = ["#F59E0B", "#94A3B8", "#CD7C2F", "#0052CC", "#6554C0", "#00875A"]

export default function MenuPerformance() {
  const todayStr  = new Date().toISOString().slice(0, 10)
  const [range,      setRange]      = useState("today")
  const [customDate, setCustomDate] = useState(todayStr)
  const [loading,      setLoading]      = useState(true)
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const [sortBy,       setSortBy]       = useState("qty")   // "qty" | "revenue"

  const [items,      setItems]      = useState([])
  const [categories, setCategories] = useState([])
  const [totals,     setTotals]     = useState({ orders:0, itemsSold:0, revenue:0 })

  const load = useCallback(async () => {
    setLoading(true)
    const { fromStr, toStr } = buildDateRange(range, customDate)
    let q = supabase.from("orders")
      .select("*")
      .gte("created_at", fromStr)
    if (toStr) q = q.lte("created_at", toStr)
    const { data, error } = await q
    if (error) { console.error(error); setLoading(false); return }

    const orders = (data || []).filter(o => !o.status || o.status === "Paid" || o.status === "paid")

    // Build item + category maps
    const itemMap = {}
    const catMap  = {}
    let totalItems = 0

    orders.forEach(o => {
      const raw    = o.items_snapshot || o.items || []
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
      ;(parsed || []).forEach(i => {
        const name = i.name || "Unknown"
        const cat  = i.cat  || o.cat || "Lainnya"
        const qty  = i.qty  || 1
        const rev  = (i.price || 0) * qty
        totalItems += qty

        if (!itemMap[name]) itemMap[name] = { name, cat, qty:0, revenue:0, orders:0 }
        itemMap[name].qty     += qty
        itemMap[name].revenue += rev
        itemMap[name].orders  += 1

        if (!catMap[cat]) catMap[cat] = { cat, qty:0, revenue:0 }
        catMap[cat].qty     += qty
        catMap[cat].revenue += rev
      })
    })

    const revenue = orders.reduce((s, o) => s + (o.total || 0), 0)
    setTotals({ orders:orders.length, itemsSold:totalItems, revenue })

    const itemArr = Object.values(itemMap).sort((a, b) =>
      sortBy === "qty" ? b.qty - a.qty : b.revenue - a.revenue
    )
    setItems(itemArr)

    const catArr = Object.values(catMap).sort((a, b) => b.qty - a.qty)
    setCategories(catArr)
    setLastUpdated(new Date())
    setLoading(false)
  }, [range, customDate, sortBy])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel("menu_perf_rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"orders" }, () => loadRef.current())
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"orders" }, () => loadRef.current())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  useEffect(() => {
    const poll = setInterval(() => { if (!document.hidden) loadRef.current() }, 10000)
    const onVisible = () => { if (!document.hidden) loadRef.current() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(poll); document.removeEventListener("visibilitychange", onVisible) }
  }, [])

  const topItems  = items.slice(0, 10)
  const slowItems = items.slice(-5).reverse()
  const maxQty    = topItems[0]?.qty    || 1
  const maxRev    = topItems[0]?.revenue || 1

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate} loading={loading} lastUpdated={lastUpdated} onRefresh={() => loadRef.current()}>
        {/* Sort toggle in right slot */}
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={() => setSortBy("qty")}
            className={"bo-btn bo-btn-sm " + (sortBy === "qty" ? "bo-btn-primary" : "bo-btn-ghost")}>
            by Qty
          </button>
          <button onClick={() => setSortBy("revenue")}
            className={"bo-btn bo-btn-sm " + (sortBy === "revenue" ? "bo-btn-primary" : "bo-btn-ghost")}>
            by Revenue
          </button>
        </div>
      </DateRangePicker>

      {/* ── Quick summary ─────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        {[
          { label:"Total Transaksi",  value:totals.orders,    color:"#0052CC" },
          { label:"Total Item Terjual", value:totals.itemsSold, color:"#6554C0" },
          { label:"Menu Berbeda",     value:items.length,     color:"#059669" },
        ].map(k => (
          <div key={k.label} style={{ background:"#fff", borderRadius:12, padding:"14px 16px", border:"1px solid var(--surface3)" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--ink4)", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:900, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="bo-menu-perf-grid" style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, marginBottom:16 }}>

        {/* ── Top 10 Items ──────────────────────────────── */}
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title">
            Top 10 Menu
            <span style={{ fontSize:11, color:"var(--ink5)", fontWeight:400, marginLeft:8 }}>
              {sortBy === "qty" ? "berdasarkan jumlah terjual" : "berdasarkan revenue"}
            </span>
          </div>
          {topItems.length === 0
            ? <div style={{ color:"var(--ink5)", fontSize:13, padding:"20px 0", textAlign:"center" }}>Belum ada data</div>
            : topItems.map((item, i) => {
              const barPct = sortBy === "qty"
                ? Math.round(item.qty / maxQty * 100)
                : Math.round(item.revenue / maxRev * 100)
              const rankColor = RANK_COLORS[i] || "var(--ink4)"
              return (
                <div key={item.name} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                  {/* Rank */}
                  <div style={{
                    width:26, height:26, borderRadius:"50%",
                    background: i < 3 ? rankColor : "var(--surface2)",
                    color: i < 3 ? "#fff" : "var(--ink4)",
                    fontSize:10, fontWeight:900,
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                  }}>
                    {i + 1}
                  </div>

                  {/* Name + bar */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {item.name}
                      </span>
                      <span style={{ fontSize:11, color:"var(--ink3)", flexShrink:0, marginLeft:8 }}>
                        {sortBy === "qty" ? item.qty + "×" : fmtK(item.revenue)}
                      </span>
                    </div>
                    <div style={{ height:5, background:"var(--surface2)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{
                        height:"100%", width: barPct + "%",
                        background: i < 3 ? rankColor : "var(--brand)",
                        borderRadius:3, transition:"width 0.4s",
                      }} />
                    </div>
                    <div style={{ fontSize:10, color:"var(--ink5)", marginTop:2 }}>
                      {sortBy === "qty"
                        ? fmtK(item.revenue) + " revenue"
                        : item.qty + "× terjual"
                      } · {item.cat || "—"}
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* ── Category Breakdown ───────────────────────── */}
        <div className="bo-card" style={{ marginBottom:0 }}>
          <div className="bo-card-title">Kategori</div>
          {categories.length === 0
            ? <div style={{ color:"var(--ink5)", fontSize:13, padding:"20px 0", textAlign:"center" }}>Belum ada data</div>
            : (() => {
              const maxCatQty = categories[0]?.qty || 1
              return categories.map((c, i) => (
                <div key={c.cat} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>{c.cat}</span>
                    <span style={{ fontSize:11, color:"var(--ink3)", fontWeight:700 }}>{c.qty}×</span>
                  </div>
                  <div style={{ height:5, background:"var(--surface2)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{
                      height:"100%",
                      width: Math.round(c.qty / maxCatQty * 100) + "%",
                      background: RANK_COLORS[i % RANK_COLORS.length],
                      borderRadius:3,
                    }} />
                  </div>
                  <div style={{ fontSize:10, color:"var(--ink5)", marginTop:2 }}>{fmtK(c.revenue)}</div>
                </div>
              ))
            })()
          }
        </div>
      </div>

      {/* ── Slow movers ───────────────────────────────── */}
      {slowItems.length > 0 && items.length > 5 && (
        <div className="bo-card">
          <div className="bo-card-title">
            Slow Movers
            <span style={{ fontSize:11, color:"var(--ink5)", fontWeight:400, marginLeft:8 }}>menu paling sedikit terjual</span>
          </div>
          <table className="bo-table">
            <thead>
              <tr><th>Menu</th><th>Kategori</th><th style={{ textAlign:"right" }}>Qty Terjual</th><th style={{ textAlign:"right" }}>Revenue</th></tr>
            </thead>
            <tbody>
              {slowItems.map(item => (
                <tr key={item.name}>
                  <td style={{ fontWeight:600 }}>{item.name}</td>
                  <td style={{ color:"var(--ink4)" }}>{item.cat || "—"}</td>
                  <td style={{ textAlign:"right", color:"#EF4444", fontWeight:700 }}>{item.qty}×</td>
                  <td style={{ textAlign:"right" }}>{fmtK(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
