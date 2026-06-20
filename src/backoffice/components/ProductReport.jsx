import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n) { return "Rp " + Number(n||0).toLocaleString("id-ID") }
function today() { return new Date().toISOString().slice(0,10) }
function firstOfMonth() {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10)
}

export default function ProductReport() {
  const [from,     setFrom]     = useState(firstOfMonth())
  const [to,       setTo]       = useState(today())
  const [catFilter,setCatFilter]= useState("")
  const [sortBy,   setSortBy]   = useState("qty") // qty | revenue
  const [rows,     setRows]     = useState([])
  const [cats,     setCats]     = useState([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { loadCats() }, [])
  useEffect(() => { load() }, [from, to])

  async function loadCats() {
    const { data } = await supabase.from("categories").select("name").order("sort")
    setCats((data||[]).map(c => c.name))
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from("orders")
      .select("items,items_snapshot,order_items")
      .eq("status","Paid")
      .gte("date", from)
      .lte("date", to)
    if (error) { console.error(error); setLoading(false); return }

    const map = {}
    ;(data||[]).forEach(o => {
      const raw = o.items_snapshot||o.order_items||o.items||[]
      const items = typeof raw === "string" ? JSON.parse(raw) : raw
      ;(items||[]).forEach(i => {
        const key = i.name
        if (!map[key]) map[key] = { name:i.name, cat:i.cat||"—", qty:0, revenue:0, prices:[] }
        map[key].qty     += i.qty||1
        map[key].revenue += (i.price||0)*(i.qty||1)
        map[key].prices.push(i.price||0)
      })
    })

    const result = Object.values(map).map(r => ({
      ...r,
      avgPrice: r.qty ? Math.round(r.revenue/r.qty) : 0
    }))
    setRows(result)
    setLoading(false)
  }

  const filtered = rows
    .filter(r => !catFilter || r.cat === catFilter)
    .sort((a,b) => sortBy === "qty" ? b.qty - a.qty : b.revenue - a.revenue)

  const totals = filtered.reduce((s,r) => ({ qty: s.qty+r.qty, revenue: s.revenue+r.revenue }), { qty:0, revenue:0 })

  return (
    <div>
      <div className="bo-card" style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div>
            <label className="bo-label">Dari</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="bo-input" style={{width:160}}/>
          </div>
          <div>
            <label className="bo-label">Sampai</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="bo-input" style={{width:160}}/>
          </div>
          <div>
            <label className="bo-label">Kategori</label>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="bo-select" style={{width:180}}>
              <option value="">Semua Kategori</option>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="bo-label">Urut berdasarkan</label>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="bo-select" style={{width:160}}>
              <option value="qty">Qty Terjual</option>
              <option value="revenue">Revenue</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading
          ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Memuat...</div>
          : filtered.length === 0
            ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Tidak ada data pada periode ini</div>
            : (
              <table className="bo-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Produk</th>
                    <th>Kategori</th>
                    <th style={{textAlign:"right"}}>Qty Terjual</th>
                    <th style={{textAlign:"right"}}>Revenue</th>
                    <th style={{textAlign:"right"}}>Avg Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r,i) => (
                    <tr key={r.name}>
                      <td style={{ color:"#6B778C", fontWeight:700 }}>{i+1}</td>
                      <td style={{ fontWeight:600 }}>{r.name}</td>
                      <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, background:"#F4F5F7", color:"#42526E" }}>{r.cat}</span></td>
                      <td style={{ textAlign:"right", fontWeight:800, color:"#0052CC" }}>{r.qty}×</td>
                      <td style={{ textAlign:"right", fontWeight:800, color:"#00875A" }}>{fmt(r.revenue)}</td>
                      <td style={{ textAlign:"right", color:"#6B778C" }}>{fmt(r.avgPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"#F4F5F7", fontWeight:800 }}>
                    <td colSpan={3}>TOTAL ({filtered.length} produk)</td>
                    <td style={{ textAlign:"right" }}>{totals.qty}×</td>
                    <td style={{ textAlign:"right", color:"#00875A" }}>{fmt(totals.revenue)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            )
        }
      </div>
    </div>
  )
}
