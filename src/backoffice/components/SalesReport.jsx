import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

function fmt(n)  { return "Rp " + Number(n||0).toLocaleString("id-ID") }
function today() { return new Date().toISOString().slice(0,10) }
function firstOfMonth() {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10)
}

export default function SalesReport() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to,   setTo]   = useState(today())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [from, to])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from("orders")
      .select("date,total,subtotal,tax,discount,status")
      .eq("status", "Paid")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
    if (error) { console.error(error); setLoading(false); return }

    // Group by date
    const map = {}
    ;(data||[]).forEach(o => {
      const d = o.date
      if (!map[d]) map[d] = { date:d, orders:0, subtotal:0, tax:0, discount:0, total:0 }
      map[d].orders++
      map[d].subtotal  += o.subtotal  || 0
      map[d].tax       += o.tax       || 0
      map[d].discount  += o.discount  || 0
      map[d].total     += o.total     || 0
    })
    setRows(Object.values(map).sort((a,b) => b.date.localeCompare(a.date)))
    setLoading(false)
  }

  const totals = rows.reduce((s,r) => ({
    orders:   s.orders   + r.orders,
    subtotal: s.subtotal + r.subtotal,
    tax:      s.tax      + r.tax,
    discount: s.discount + r.discount,
    total:    s.total    + r.total,
  }), { orders:0, subtotal:0, tax:0, discount:0, total:0 })

  const avgTicket = totals.orders ? Math.round(totals.total / totals.orders) : 0

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
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10, marginBottom:16 }}>
        {[
          ["Total Transaksi", totals.orders, "#0052CC"],
          ["Total Revenue",   fmt(totals.total), "#00875A"],
          ["Rata-rata Tiket", fmt(avgTicket), "#FF8B00"],
          ["Total Diskon",    fmt(totals.discount), "#DE350B"],
        ].map(([l,v,c]) => (
          <div key={l} className="bo-card" style={{ marginBottom:0 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#6B778C", marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="bo-card" style={{ padding:0, overflow:"hidden" }}>
        {loading
          ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Memuat...</div>
          : rows.length === 0
            ? <div style={{ padding:40, textAlign:"center", color:"#6B778C" }}>Tidak ada data pada periode ini</div>
            : (
              <table className="bo-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th style={{textAlign:"right"}}>Transaksi</th>
                    <th style={{textAlign:"right"}}>Subtotal</th>
                    <th style={{textAlign:"right"}}>Pajak</th>
                    <th style={{textAlign:"right"}}>Diskon</th>
                    <th style={{textAlign:"right"}}>Total</th>
                    <th style={{textAlign:"right"}}>Avg Tiket</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.date}>
                      <td style={{ fontWeight:600 }}>{new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</td>
                      <td style={{ textAlign:"right" }}>{r.orders}</td>
                      <td style={{ textAlign:"right" }}>{fmt(r.subtotal)}</td>
                      <td style={{ textAlign:"right", color:"#6B778C" }}>{fmt(r.tax)}</td>
                      <td style={{ textAlign:"right", color:"#DE350B" }}>{r.discount ? fmt(r.discount) : "—"}</td>
                      <td style={{ textAlign:"right", fontWeight:800, color:"#00875A" }}>{fmt(r.total)}</td>
                      <td style={{ textAlign:"right", color:"#6B778C" }}>{fmt(r.orders ? Math.round(r.total/r.orders) : 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"#F4F5F7", fontWeight:800 }}>
                    <td>TOTAL</td>
                    <td style={{ textAlign:"right" }}>{totals.orders}</td>
                    <td style={{ textAlign:"right" }}>{fmt(totals.subtotal)}</td>
                    <td style={{ textAlign:"right" }}>{fmt(totals.tax)}</td>
                    <td style={{ textAlign:"right", color:"#DE350B" }}>{totals.discount ? fmt(totals.discount) : "—"}</td>
                    <td style={{ textAlign:"right", color:"#00875A" }}>{fmt(totals.total)}</td>
                    <td style={{ textAlign:"right" }}>{fmt(avgTicket)}</td>
                  </tr>
                </tfoot>
              </table>
            )
        }
      </div>
    </div>
  )
}
