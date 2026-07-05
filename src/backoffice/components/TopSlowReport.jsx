import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase } from "../../lib/supabase"
import DateRangePicker, { buildDateRange } from "./DateRangePicker"
import MultiItemSelect from "./MultiItemSelect"
import { exportPDF, exportExcel, formatPeriodLabel, filenameSlug, fmtIDR } from "./exportUtils"

const fmt   = n => "Rp " + Number(n||0).toLocaleString("en-US")
const today = () => new Date().toISOString().slice(0,10)

export default function TopSlowReport() {
  const [range,       setRange]       = useState("month")
  const [customDate,  setCustomDate]  = useState(today())
  const [customDateTo,setCustomDateTo]= useState(today())
  const [tab,         setTab]         = useState("food")
  const [allItems,    setAllItems]    = useState([])
  const [itemFilter,  setItemFilter]  = useState(new Set())
  const [loading,     setLoading]     = useState(false)
  const [err,         setErr]         = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const { fromStr, toStr } = buildDateRange(range, customDate, customDateTo)
    let q = supabase.from("orders").select("items").eq("status","Paid").gte("created_at", fromStr)
    if (toStr) q = q.lte("created_at", toStr)
    const { data, error } = await q
    if (error) { setErr(error.message); setLoading(false); return }

    const map = {}
    ;(data||[]).forEach(o => {
      const raw = o.items_snapshot||o.order_items||o.items||[]
      const items = typeof raw === "string" ? JSON.parse(raw) : raw
      ;(items||[]).forEach(i => {
        if (!map[i.name]) map[i.name] = { name:i.name, cat:i.cat||"", qty:0, revenue:0 }
        map[i.name].qty     += i.qty||1
        map[i.name].revenue += (i.price||0)*(i.qty||1)
      })
    })
    setAllItems(Object.values(map).sort((a,b) => b.qty-a.qty))
    setLastUpdated(new Date())
    setLoading(false)
  }, [range, customDate, customDateTo])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => { load() }, [load])

  const allItemNames = useMemo(() => allItems.map(i => i.name).sort(), [allItems])

  const filterLabel = [
    tab === "food" ? "Makanan" : "Minuman",
    itemFilter.size > 0 ? [...itemFilter].join(", ") : null,
  ].filter(Boolean).join(" | ")
  const periodLabel = formatPeriodLabel(range, customDate, customDateTo)
  const slug = filenameSlug(range, customDate, customDateTo)

  function handleExportExcel() {
    exportExcel({
      title: "Top & Slow Moving", periodLabel, filterLabel,
      filename: "pawonloka-topslow-" + slug + ".xlsx",
      sheets: [
        {
          name: "Top 10",
          columns: ["#","Produk","Kategori","Qty","Revenue"],
          colWidths: [6,28,18,12,20],
          rows: top10.map((it,i) => [i+1, it.name, it.cat||"—", it.qty, fmtIDR(it.revenue)]),
        },
        {
          name: "Slow Movers",
          columns: ["Produk","Kategori","Qty","Revenue"],
          colWidths: [28,18,12,20],
          rows: slow.map(it => [it.name, it.cat||"—", it.qty, fmtIDR(it.revenue)]),
        },
      ],
    })
  }

  function handleExportPdf() {
    exportPDF({
      title: "Top & Slow Moving", periodLabel, filterLabel,
      filename: "pawonloka-topslow-" + slug + ".pdf",
      tables: [
        {
          label: "Top 10",
          head: ["#","Produk","Kategori","Qty","Revenue"],
          body: top10.map((it,i) => [i+1, it.name, it.cat||"—", it.qty+"×", fmtIDR(it.revenue)]),
        },
        ...(slow.length > 0 ? [{
          label: "Produk Lambat",
          head: ["Produk","Kategori","Qty","Revenue"],
          body: slow.map(it => [it.name, it.cat||"—", it.qty+"×", fmtIDR(it.revenue)]),
        }] : []),
      ],
    })
  }

  const food   = allItems.filter(i => i.cat !== "Drinks")
  const drinks = allItems.filter(i => i.cat === "Drinks")
  const baseActive = tab === "food" ? food : drinks
  const active = itemFilter.size > 0 ? baseActive.filter(i => itemFilter.has(i.name)) : baseActive
  const top10  = [...active].sort((a,b) => b.qty-a.qty).slice(0,10)
  const slow   = [...active].filter(i => i.qty <= 2).sort((a,b) => a.qty-b.qty)
  const maxQty = top10[0]?.qty||1
  const color  = tab === "food" ? "#10B981" : "#0EA5E9"

  return (
    <div>
      <DateRangePicker range={range} setRange={setRange} customDate={customDate} setCustomDate={setCustomDate}
        customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
        loading={loading} lastUpdated={lastUpdated} onRefresh={() => loadRef.current()}>
        <MultiItemSelect options={allItemNames} selected={itemFilter} onChange={setItemFilter} />
        <button onClick={handleExportExcel} className="bo-btn bo-btn-ghost bo-btn-sm">↓ Excel</button>
        <button onClick={handleExportPdf}   className="bo-btn bo-btn-ghost bo-btn-sm">↓ PDF</button>
      </DateRangePicker>

      {err && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#DC2626", fontSize:13 }}>⚠ Gagal memuat data: {err}</div>}

      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        <button onClick={()=>setTab("food")}   className={"bo-btn bo-btn-sm "+(tab==="food"  ?"bo-btn-primary":"bo-btn-ghost")}>Makanan ({food.length})</button>
        <button onClick={()=>setTab("drinks")} className={"bo-btn bo-btn-sm "+(tab==="drinks"?"bo-btn-primary":"bo-btn-ghost")}>Minuman ({drinks.length})</button>
      </div>

      {loading
        ? <div className="bo-card" style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Memuat...</div>
        : (
          <div className="bo-topslow-grid">
            <div className="bo-card">
              <div className="bo-card-title" style={{ color }}>Top 10 {tab==="food"?"Makanan":"Minuman"}</div>
              {top10.length === 0
                ? <div style={{ color:"#94A3B8", fontSize:13 }}>Belum ada data</div>
                : top10.map((it,i) => (
                  <div key={it.name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background:i===0?"#F59E0B":i===1?"#94A3B8":i===2?"#B45309":"#F4F5F7", color:i<3?"#fff":"#42526E", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{i+1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"#0A1628", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
                        <span style={{ fontSize:12, fontWeight:800, color, flexShrink:0, marginLeft:8 }}>{it.qty}×</span>
                      </div>
                      <div style={{ height:5, background:"#F4F5F7", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:Math.round(it.qty/maxQty*100)+"%", background:color, borderRadius:3 }}/>
                      </div>
                      <div style={{ fontSize:10, color:"#6B778C", marginTop:2 }}>{fmt(it.revenue)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="bo-card">
              <div className="bo-card-title" style={{ color:"#F59E0B" }}>Produk Lambat</div>
              {slow.length === 0
                ? <div style={{ color:"#10B981", fontSize:13, fontWeight:600 }}>✓ Semua produk terjual dengan baik!</div>
                : slow.map(it => (
                  <div key={it.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", borderRadius:10, background:"#FFFBEB", border:"1px solid #FEF3C7", marginBottom:7 }}>
                    <div>
                      <div style={{ fontSize:13, color:"#0A1628", fontWeight:600 }}>{it.name}</div>
                      <div style={{ fontSize:10, color:"#94A3B8", marginTop:2 }}>{fmt(it.revenue)} · {it.cat}</div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:12, background:"#FEF3C7", color:"#92400E", flexShrink:0, marginLeft:8 }}>hanya {it.qty}×</span>
                  </div>
                ))
              }
            </div>
          </div>
        )
      }
    </div>
  )
}
