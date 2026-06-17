import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import "./owner.css"

/* ─── helpers ─── */
function fmt(n)  { return "Rp " + Number(n || 0).toLocaleString("id-ID") }
function fmtK(n) {
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1).replace(".0","") + " jt"
  if (n >= 1_000)     return "Rp " + (n / 1_000).toFixed(0) + " rb"
  return fmt(n)
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })
}
function today()    { return new Date().toISOString().slice(0,10) }
function yestStr()  { return new Date(Date.now()-86400000).toISOString().slice(0,10) }

/* ─── demo data ─── */
const DEMO = (() => {
  const d = today(), y = yestStr()
  return [
    {id:"d1",  code:"#1001",created_at:`${d}T08:14:00`,total:57750, pay:"Cash", staff:"Budi",table_name:"Table 2", customer_id:"c1",cogs:14000,items_snapshot:[{name:"Nasi Goreng Telur",qty:2,price:20000},{name:"Teh Manis",qty:2,price:8000}]},
    {id:"d2",  code:"#1002",created_at:`${d}T08:38:00`,total:59290, pay:"QRIS", staff:"Budi",table_name:"Walk-in", customer_id:"c2",cogs:15000,items_snapshot:[{name:"Ayam Bakar",qty:1,price:28000},{name:"Americano",qty:1,price:25000}]},
    {id:"d3",  code:"#1003",created_at:`${d}T09:05:00`,total:57750, pay:"GoPay",staff:"Raka",table_name:"Table 4", customer_id:"c3",cogs:12000,items_snapshot:[{name:"Matcha Latte",qty:2,price:25000}]},
    {id:"d4",  code:"#1004",created_at:`${d}T09:44:00`,total:57750, pay:"Card", staff:"Budi",table_name:"Table 1", customer_id:null, cogs:16000,items_snapshot:[{name:"Sate Kambing",qty:1,price:38000},{name:"Es Jeruk",qty:1,price:12000}]},
    {id:"d5",  code:"#1005",created_at:`${d}T10:20:00`,total:28875, pay:"Cash", staff:"Raka",table_name:"Walk-in", customer_id:"c4",cogs:7000, items_snapshot:[{name:"Bakmi Goreng",qty:1,price:25000}]},
    {id:"d6",  code:"#1006",created_at:`${d}T10:45:00`,total:57750, pay:"Cash", staff:"Budi",table_name:"Table 3", customer_id:null, cogs:13000,items_snapshot:[{name:"Latte",qty:2,price:25000}]},
    {id:"d7",  code:"#1007",created_at:`${d}T11:10:00`,total:49588, pay:"QRIS", staff:"Raka",table_name:"Table 5", customer_id:"c2",cogs:11000,items_snapshot:[{name:"Nasi Goreng Spesial",qty:1,price:25000},{name:"Jus Alpukat",qty:1,price:18000}]},
    {id:"d8",  code:"#1008",created_at:`${d}T11:35:00`,total:50820, pay:"OVO",  staff:"Budi",table_name:"Table 2", customer_id:null, cogs:9000, items_snapshot:[{name:"Gado Gado",qty:2,price:22000}]},
    {id:"d9",  code:"#1009",created_at:`${d}T12:05:00`,total:96712, pay:"Card", staff:"Raka",table_name:"VIP Room",customer_id:"c5",cogs:21000,items_snapshot:[{name:"Cappuccino",qty:3,price:28000}]},
    {id:"d10", code:"#1010",created_at:`${d}T12:30:00`,total:73140, pay:"Cash", staff:"Budi",table_name:"Table 1", customer_id:null, cogs:15000,items_snapshot:[{name:"Soto Ayam",qty:2,price:20000},{name:"Teh Tarik",qty:2,price:12000}]},
    {id:"d11", code:"#1011",created_at:`${d}T13:00:00`,total:25300, pay:"GoPay",staff:"Raka",table_name:"Walk-in", customer_id:"c3",cogs:8000, items_snapshot:[{name:"Bakso Malang",qty:1,price:22000}]},
    {id:"d12", code:"#1012",created_at:`${d}T13:25:00`,total:67650, pay:"Cash", staff:"Budi",table_name:"Table 3", customer_id:null, cogs:14000,items_snapshot:[{name:"Es Kopi Susu",qty:2,price:22000},{name:"Mendoan",qty:1,price:15000}]},
    {id:"d13", code:"#1013",created_at:`${d}T14:00:00`,total:41400, pay:"QRIS", staff:"Raka",table_name:"Outdoor", customer_id:null, cogs:7500, items_snapshot:[{name:"Pisang Goreng",qty:3,price:12000}]},
    {id:"d14", code:"#1014",created_at:`${d}T14:30:00`,total:80500, pay:"Card", staff:"Budi",table_name:"Table 4", customer_id:"c4",cogs:22000,items_snapshot:[{name:"Nasi Goreng Seafood",qty:2,price:35000}]},
    {id:"d15", code:"#1015",created_at:`${d}T15:10:00`,total:49588, pay:"OVO",  staff:"Raka",table_name:"Walk-in", customer_id:null, cogs:12000,items_snapshot:[{name:"Latte",qty:1,price:25000},{name:"Croissant",qty:1,price:18000}]},
    {id:"y1",  code:"#0901",created_at:`${y}T09:00:00`, total:23000, pay:"Cash", staff:"Budi",table_name:"Table 1", customer_id:null, cogs:5500, items_snapshot:[{name:"Nasi Goreng Telur",qty:1,price:20000}]},
    {id:"y2",  code:"#0902",created_at:`${y}T10:00:00`, total:57750, pay:"QRIS", staff:"Raka",table_name:"Table 2", customer_id:"c2",cogs:13800,items_snapshot:[{name:"Latte",qty:2,price:25000}]},
    {id:"y3",  code:"#0903",created_at:`${y}T12:00:00`, total:32200, pay:"GoPay",staff:"Budi",table_name:"Walk-in", customer_id:null, cogs:9200, items_snapshot:[{name:"Ayam Bakar",qty:1,price:28000}]},
    {id:"y4",  code:"#0904",created_at:`${y}T14:00:00`, total:75900, pay:"Cash", staff:"Raka",table_name:"Table 5", customer_id:"c5",cogs:19800,items_snapshot:[{name:"Es Kopi Susu",qty:3,price:22000}]},
    {id:"y5",  code:"#0905",created_at:`${y}T15:30:00`, total:57750, pay:"Card", staff:"Budi",table_name:"Table 3", customer_id:null, cogs:14400,items_snapshot:[{name:"Bakmi Goreng",qty:2,price:25000}]},
  ]
})()

const PAY_COLOR = { Cash:"#10B981", QRIS:"#0EA5E9", Card:"#3B82F6", GoPay:"#06B6D4", OVO:"#8B5CF6", Other:"#94A3B8" }
const PAY_BADGE = { Cash:"ow-badge-green", QRIS:"ow-badge-blue", Card:"ow-badge-blue", GoPay:"ow-badge-blue", OVO:"ow-badge-purple", Other:"ow-badge-amber" }
const OWNER_PIN = "1234"

/* ─── SVG Hourly chart ─── */
function HourlyChart({ data }) {
  const [tip, setTip] = useState(null)
  if (!data.length || data.every(h => h.sales === 0)) {
    return <div className="ow-empty">Belum ada data untuk periode ini</div>
  }
  const W=560, H=130, PL=44, PR=12, PT=10, PB=26
  const cW=W-PL-PR, cH=H-PT-PB
  const maxS = Math.max(...data.map(h=>h.sales), 1)
  const maxT = Math.max(...data.map(h=>h.tx), 1)
  const n = data.length
  const sx = i => PL + (i/(n-1))*cW
  const sy = v => PT + cH - (v/maxS)*cH
  const ty = v => PT + cH - (v/maxT)*cH

  function curve(pts) {
    if (pts.length < 2) return ""
    let d = `M${pts[0][0]},${pts[0][1]}`
    for (let i=1; i<pts.length; i++) {
      const [x0,y0]=pts[i-1], [x1,y1]=pts[i], cx=(x0+x1)/2
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
    }
    return d
  }
  const sp = data.map((h,i)=>[sx(i),sy(h.sales)])
  const tp = data.map((h,i)=>[sx(i),ty(h.tx)])
  const fill = curve(sp)+` L${sp[n-1][0]},${PT+cH} L${sp[0][0]},${PT+cH} Z`

  const yTicks = [0,0.5,1].map(f => ({ y:PT+cH-f*cH, lbl:fmtK(f*maxS) }))

  return (
    <div style={{position:"relative"}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}
        onMouseLeave={()=>setTip(null)}>
        <defs>
          <linearGradient id="owFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity=".18"/>
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {yTicks.map((t,i)=>(
          <g key={i}>
            <line x1={PL} x2={W-PR} y1={t.y} y2={t.y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray={i?"3 3":""}/>
            <text x={PL-5} y={t.y+4} textAnchor="end" fontSize="9" fill="#94A3B8">{t.lbl}</text>
          </g>
        ))}
        {data.map((h,i)=> i%2===0 && (
          <text key={i} x={sx(i)} y={H-4} textAnchor="middle" fontSize="9" fill="#94A3B8">
            {h.hour.replace(":00","")}
          </text>
        ))}
        <path d={fill} fill="url(#owFill)"/>
        <path d={curve(sp)} fill="none" stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round"/>
        <path d={curve(tp)} fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3"/>
        {data.map((h,i)=>(
          <g key={i}>
            <rect x={sx(i)-cW/n/2} y={PT} width={cW/n} height={cH} fill="transparent"
              style={{cursor:"crosshair"}} onMouseEnter={()=>setTip({i,h})}/>
            {tip?.i===i && <>
              <line x1={sx(i)} x2={sx(i)} y1={PT} y2={PT+cH} stroke="#E2E8F0" strokeWidth="1"/>
              <circle cx={sx(i)} cy={sy(h.sales)} r="4" fill="#0EA5E9" stroke="#fff" strokeWidth="2"/>
              <circle cx={sx(i)} cy={ty(h.tx)} r="3.5" fill="#F59E0B" stroke="#fff" strokeWidth="2"/>
            </>}
          </g>
        ))}
      </svg>
      {tip && (
        <div style={{
          position:"absolute",top:4,left:12,
          background:"#0F172A",color:"#fff",
          borderRadius:10,padding:"8px 12px",fontSize:11,lineHeight:1.7,
          pointerEvents:"none",zIndex:10,
          boxShadow:"0 4px 16px rgba(15,23,42,0.3)"
        }}>
          <div style={{fontWeight:700,marginBottom:2}}>{tip.h.hour}</div>
          <div style={{color:"#7DD3FC"}}>{fmt(tip.h.sales)}</div>
          <div style={{color:"#FCD34D"}}>{tip.h.tx} transaksi</div>
        </div>
      )}
      <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:10}}>
        {[["#0EA5E9","Penjualan per jam"],["#F59E0B","Transaksi per jam"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#94A3B8"}}>
            <span style={{width:18,height:2,background:c,borderRadius:2,display:"inline-block"}}/>
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main screens ─── */
function ScreenDashboard({ range, setRange, loading, stats, hourData, payments, topItems, slowItems, recent }) {
  const trend = stats.prevSales > 0
    ? Math.round((stats.sales - stats.prevSales) / stats.prevSales * 100)
    : null
  const margin = stats.sales > 0 ? Math.round(stats.grossProfit / stats.sales * 100) : 0
  const RLABELS = { today:"Hari Ini", week:"Minggu Ini", month:"Bulan Ini" }

  return (
    <div style={{maxWidth:1100}}>

      {/* toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <div className="ow-range-group">
          {[["today","Hari Ini"],["week","Minggu Ini"],["month","Bulan Ini"]].map(([v,l])=>(
            <button key={v} className={"ow-range-btn"+(range===v?" active":"")} onClick={()=>setRange(v)}>{l}</button>
          ))}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {loading && (
            <svg className="ow-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#E2E8F0" strokeWidth="3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#0EA5E9" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          )}
          <span style={{fontSize:11,color:"#94A3B8"}}>{new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"})}</span>
        </div>
      </div>

      {/* hero */}
      <div className="ow-hero" style={{marginBottom:14}}>
        <div className="ow-hero-label">Total Penjualan · {RLABELS[range]}</div>
        <div className="ow-hero-amount">
          {fmt(stats.sales)}
          {trend !== null && (
            <span className={"ow-trend "+(trend>=0?"up":"down")}>
              {trend>=0?"▲":"▼"} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div className="ow-hero-meta">
          <div className="ow-hero-meta-item">{stats.orders} <strong>Transaksi</strong></div>
          {range==="today" && <>
            <div className="ow-hero-meta-item">MTD <strong>{fmtK(stats.mtd)}</strong></div>
            <div className="ow-hero-meta-item">Proyeksi <strong>{fmtK(stats.projection)}</strong></div>
          </>}
          <div className="ow-hero-meta-item">Avg/Transaksi <strong>{fmt(stats.avgOrder)}</strong></div>
          {stats.unpaid > 0 && <div className="ow-hero-meta-item" style={{color:"#FCD34D"}}>Open Bills <strong>{fmt(stats.unpaid)}</strong></div>}
        </div>
      </div>

      {/* stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        <div className="ow-stat">
          <div className="ow-stat-accent" style={{background:"#10B981"}}/>
          <div className="ow-stat-label">Laba Kotor</div>
          <div className="ow-stat-val" style={{color: stats.grossProfit>=0?"#10B981":"#EF4444"}}>{fmt(stats.grossProfit)}</div>
          <div className="ow-stat-sub">Margin <strong style={{color:margin>=30?"#10B981":"#F59E0B"}}>{margin}%</strong>
            {margin < 30 && <span style={{color:"#F59E0B",marginLeft:4}}>· di bawah target</span>}
          </div>
        </div>
        <div className="ow-stat">
          <div className="ow-stat-accent" style={{background:"#8B5CF6"}}/>
          <div className="ow-stat-label">Produk Terjual</div>
          <div className="ow-stat-val" style={{color:"#8B5CF6"}}>{stats.totalSold}</div>
          <div className="ow-stat-sub">{stats.avgItems} item per transaksi</div>
        </div>
        <div className="ow-stat">
          <div className="ow-stat-accent" style={{background:"#0EA5E9"}}/>
          <div className="ow-stat-label">Pelanggan</div>
          <div className="ow-stat-val" style={{color:"#0EA5E9"}}>{stats.customers}</div>
          <div className="ow-stat-sub">Tercatat dalam periode ini</div>
        </div>
      </div>

      {/* hourly chart */}
      <div className="ow-card" style={{marginBottom:16}}>
        <div className="ow-card-title">
          Performa Per Jam
          <span className="ow-card-title-sub">{RLABELS[range]}</span>
        </div>
        <HourlyChart data={hourData}/>
      </div>

      {/* product intel + payments */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>

        {/* product intel */}
        <div className="ow-card" style={{marginBottom:0}}>
          <div className="ow-card-title">Pergerakan Produk</div>

          {/* top sellers */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:"#10B981",textTransform:"uppercase",letterSpacing:"1px",marginBottom:10,display:"flex",alignItems:"center",gap:5}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
              Produk Terlaris
            </div>
            {topItems.length===0
              ? <div className="ow-empty" style={{padding:"8px 0"}}>Belum ada data</div>
              : topItems.slice(0,5).map((it,i)=>(
                <div key={it.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
                  <div style={{
                    width:20,height:20,borderRadius:"50%",flexShrink:0,fontSize:9,fontWeight:800,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    background:i===0?"#F59E0B":i===1?"#94A3B8":i===2?"#B45309":"#F1F5F9",
                    color:i<3?"#fff":"#64748B"
                  }}>{i+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}</span>
                      <span style={{fontSize:11,fontWeight:700,color:"#0EA5E9",flexShrink:0,marginLeft:8}}>{it.qty}×</span>
                    </div>
                    <div className="ow-bar-track">
                      <div className="ow-bar-fill" style={{width:Math.round(it.qty/it.max*100)+"%",background:"#0EA5E9"}}/>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>

          <div className="ow-divider"/>

          {/* slow movers */}
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"#F59E0B",textTransform:"uppercase",letterSpacing:"1px",marginBottom:10,display:"flex",alignItems:"center",gap:5}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Produk Lambat
            </div>
            {slowItems.length===0
              ? <div style={{fontSize:12,color:"#94A3B8",padding:"4px 0"}}>Semua produk bergerak — bagus!</div>
              : slowItems.map(it=>(
                <div key={it.name} style={{
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"7px 10px",borderRadius:8,
                  background:"#FFFBEB",border:"1px solid #FEF3C7",marginBottom:5
                }}>
                  <span style={{fontSize:12,color:"#1E293B",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{it.name}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:"#FEF3C7",color:"#92400E",flexShrink:0,marginLeft:8}}>
                    hanya {it.qty}×
                  </span>
                </div>
              ))
            }
          </div>
        </div>

        {/* payment methods */}
        <div className="ow-card" style={{marginBottom:0}}>
          <div className="ow-card-title">Metode Pembayaran</div>
          {payments.length===0
            ? <div className="ow-empty">Belum ada data</div>
            : <>
              {payments.map(p=>(
                <div key={p.method} style={{marginBottom:13}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:PAY_COLOR[p.method]||"#94A3B8",display:"inline-block"}}/>
                      <span style={{fontSize:13,fontWeight:600,color:"#1E293B"}}>{p.method}</span>
                    </div>
                    <div>
                      <span style={{fontSize:12,fontWeight:700,color:"#1E293B"}}>{fmt(p.amount)}</span>
                      <span style={{fontSize:10,color:"#94A3B8",marginLeft:6}}>{p.pct}%</span>
                    </div>
                  </div>
                  <div className="ow-bar-track" style={{height:6}}>
                    <div className="ow-bar-fill" style={{width:p.pct+"%",background:PAY_COLOR[p.method]||"#94A3B8"}}/>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
                {payments.slice(0,4).map(p=>(
                  <div key={p.method} style={{
                    flex:1,minWidth:60,textAlign:"center",
                    padding:"8px 6px",background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0"
                  }}>
                    <div style={{fontSize:15,fontWeight:800,color:PAY_COLOR[p.method]}}>{p.pct}%</div>
                    <div style={{fontSize:9,color:"#94A3B8",marginTop:2}}>{p.method}</div>
                  </div>
                ))}
              </div>
            </>
          }
        </div>
      </div>

      {/* P&L + Cash */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:14}}>
        <div className="ow-card" style={{marginBottom:0}}>
          <div className="ow-card-title">Ringkasan Laba Rugi</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:"#E2E8F0",borderRadius:12,overflow:"hidden",marginBottom:12}}>
            {[
              {label:"Gross Revenue",val:fmt(stats.sales),   color:"#1E293B"},
              {label:"Est. COGS",    val:fmt(stats.cogs),    color:"#EF4444"},
              {label:"Gross Profit", val:fmt(stats.grossProfit),color:stats.grossProfit>=0?"#10B981":"#EF4444"},
            ].map(r=>(
              <div key={r.label} style={{padding:"14px 16px",background:"#fff",textAlign:"center"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.7px",marginBottom:6}}>{r.label}</div>
                <div style={{fontSize:17,fontWeight:900,color:r.color,letterSpacing:"-0.5px"}}>{r.val}</div>
              </div>
            ))}
          </div>
          {stats.sales > 0 && (
            <div style={{
              padding:"10px 14px",borderRadius:10,
              background:margin>=30?"#D1FAE5":"#FEF3C7",
              fontSize:12,fontWeight:600,
              color:margin>=30?"#065F46":"#92400E",
              display:"flex",justifyContent:"space-between",alignItems:"center"
            }}>
              <span>Gross margin saat ini: <strong>{margin}%</strong></span>
              <span style={{fontSize:11,fontWeight:500}}>{margin>=30?"Sehat":"Di bawah target 30%"}</span>
            </div>
          )}
        </div>

        <div className="ow-card" style={{marginBottom:0}}>
          <div className="ow-card-title">Kas & Pembayaran</div>
          {[
            {label:"Tunai",    val:payments.find(p=>p.method==="Cash")?.amount||0,  color:"#10B981", icon:<IconCash/>},
            {label:"Non-Tunai",val:payments.filter(p=>p.method!=="Cash").reduce((s,p)=>s+p.amount,0), color:"#0EA5E9",icon:<IconCard/>},
            {label:"Total",    val:stats.sales, color:"#1E293B", icon:<IconTotal/>},
          ].map((r,i,arr)=>(
            <div key={r.label} style={{
              display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"10px 0",
              borderBottom:i<arr.length-1?"1px solid #F1F5F9":"none"
            }}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:8,background:"#F8FAFC",display:"flex",alignItems:"center",justifyContent:"center",color:r.color}}>{r.icon}</div>
                <span style={{fontSize:12,color:"#334155",fontWeight:500}}>{r.label}</span>
              </div>
              <span style={{fontSize:13,fontWeight:800,color:r.color}}>{fmt(r.val)}</span>
            </div>
          ))}
          {stats.unpaid > 0 && (
            <div style={{marginTop:12,padding:"8px 12px",background:"#FEF3C7",borderRadius:8,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:"#92400E",fontWeight:600}}>Open Bills</span>
              <span style={{fontSize:12,fontWeight:800,color:"#92400E"}}>{fmt(stats.unpaid)}</span>
            </div>
          )}
        </div>
      </div>

      {/* recent orders */}
      <div className="ow-card">
        <div className="ow-card-title">
          Transaksi Terakhir
          <span className="ow-card-title-sub">{recent.length} dari {stats.orders} total</span>
        </div>
        <table className="ow-table">
          <thead>
            <tr>
              <th>Order</th><th>Meja</th><th>Kasir</th>
              <th>Pembayaran</th>
              <th style={{textAlign:"right"}}>Total</th>
              <th style={{textAlign:"right"}}>Waktu</th>
            </tr>
          </thead>
          <tbody>
            {recent.length===0
              ? <tr><td colSpan={6} className="ow-empty">Belum ada transaksi</td></tr>
              : recent.map(o=>(
                <tr key={o.id}>
                  <td style={{fontWeight:700,color:"#0EA5E9"}}>{o.code||"#"+String(o.id).slice(-6)}</td>
                  <td>{o.table_name||o.table||"Walk-in"}</td>
                  <td style={{color:"#64748B",fontSize:12}}>{o.staff||"—"}</td>
                  <td><span className={"ow-badge "+(PAY_BADGE[o.pay]||"ow-badge-amber")}>{o.pay||"—"}</span></td>
                  <td style={{textAlign:"right",fontWeight:700}}>{fmt(o.total)}</td>
                  <td style={{textAlign:"right",color:"#94A3B8",fontSize:12}}>{fmtTime(o.created_at)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── mini icon components ─── */
function IconCash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
}
function IconCard() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
}
function IconTotal() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
}

/* ─── Nav icon svgs ─── */
const NAV = [
  { id:"dashboard", label:"Dashboard",    icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { id:"products",  label:"Produk",       icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
  { id:"staff",     label:"Karyawan",     icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id:"cashflow",  label:"Arus Kas",     icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
]

/* ─── Data hook ─── */
function useOwnerData(range, demo) {
  const [loading,   setLoading]   = useState(true)
  const [stats,     setStats]     = useState({sales:0,orders:0,customers:0,avgOrder:0,grossProfit:0,prevSales:0,unpaid:0,totalSold:0,avgItems:0,mtd:0,projection:0,cogs:0})
  const [payments,  setPayments]  = useState([])
  const [topItems,  setTopItems]  = useState([])
  const [slowItems, setSlowItems] = useState([])
  const [hourData,  setHourData]  = useState([])
  const [recent,    setRecent]    = useState([])

  useEffect(() => { load() }, [range, demo])

  useEffect(() => {
    const ch = supabase.channel("owner_rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"orders"},()=>load())
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"orders"},()=>load())
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  }, [range, demo])

  async function load() {
    setLoading(true)
    let orders = []

    if (demo) {
      orders = DEMO
    } else {
      const now = new Date(), from = new Date()
      if (range==="today") { from.setHours(0,0,0,0) }
      if (range==="week")  { from.setDate(now.getDate()-now.getDay()); from.setHours(0,0,0,0) }
      if (range==="month") { from.setDate(1); from.setHours(0,0,0,0) }
      const fromStr = from.getFullYear()+"-"+String(from.getMonth()+1).padStart(2,"0")+"-"+String(from.getDate()).padStart(2,"0")+"T00:00:00+08:00"
      const {data,error} = await supabase.from("orders").select("*").eq("status","Paid")
        .gte("created_at",fromStr).order("created_at",{ascending:false})
      if (error) { console.error(error); setLoading(false); return }
      orders = data || []
    }

    const td=today(), yd=yestStr()
    const wk=(() =>{ const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().slice(0,10) })()
    const mo=new Date().toISOString().slice(0,7)+"-01"

    const inPeriod = o => {
      const d=o.created_at.slice(0,10)
      if(range==="today")return d===td
      if(range==="week") return d>=wk
      if(range==="month")return d>=mo
      return true
    }

    const period = demo ? orders.filter(inPeriod) : orders
    const prev   = demo ? orders.filter(o=>o.created_at.slice(0,10)===yd) : []

    const paid   = period.filter(o=>!o.status||o.status==="Paid"||o.status==="paid")
    const open   = period.filter(o=>o.status==="Open"||o.status==="open")

    const sales      = paid.reduce((s,o)=>s+(o.total||0),0)
    const unpaid     = open.reduce((s,o)=>s+(o.total||0),0)
    const cogs       = paid.reduce((s,o)=>s+(o.cogs||0),0)
    const prevSales  = demo ? prev.reduce((s,o)=>s+(o.total||0),0) : 0
    const avgOrder   = paid.length ? Math.round(sales/paid.length) : 0
    const customers  = new Set(paid.filter(o=>o.customer_id).map(o=>o.customer_id)).size
    const totalSold  = paid.reduce((s,o)=>{
      const it=o.items_snapshot||o.order_items||[]
      const p=typeof it==="string"?JSON.parse(it):it
      return s+(p||[]).reduce((ss,i)=>ss+(i.qty||1),0)
    },0)
    const avgItems   = paid.length ? Math.round(totalSold/paid.length*10)/10 : 0
    const mtd        = sales
    const dom        = new Date().getDate()
    const dim        = new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()
    const projection = dom>0 ? Math.round(mtd/dom*dim) : 0

    // payments
    const pm={}
    paid.forEach(o=>{ const m=o.pay||"Other"; pm[m]=(pm[m]||0)+(o.total||0) })
    const payArr=Object.entries(pm).map(([method,amount])=>({method,amount,pct:sales?Math.round(amount/sales*100):0})).sort((a,b)=>b.amount-a.amount)

    // items
    const im={}
    paid.forEach(o=>{
      const it=o.items_snapshot||o.order_items||[]
      const p=typeof it==="string"?JSON.parse(it):it
      ;(p||[]).forEach(i=>{
        if(!im[i.name])im[i.name]={name:i.name,qty:0,revenue:0}
        im[i.name].qty+=(i.qty||1)
        im[i.name].revenue+=(i.price||0)*(i.qty||1)
      })
    })
    const allItems=Object.values(im).sort((a,b)=>b.qty-a.qty)
    const topArr  =allItems.slice(0,5)
    const maxQty  =topArr[0]?.qty||1
    const slowArr =allItems.filter(i=>i.qty<=2).sort((a,b)=>a.qty-b.qty).slice(0,6)

    // hourly
    const hs={}, ht={}
    for(let h=7;h<=21;h++){hs[h]=0;ht[h]=0}
    paid.forEach(o=>{
      const h=new Date(o.created_at).getHours()
      if(h>=7&&h<=21){hs[h]=(hs[h]||0)+(o.total||0);ht[h]=(ht[h]||0)+1}
    })
    const hourArr=Object.entries(hs).map(([h,v])=>({hour:h+":00",sales:v,tx:ht[h]||0}))

    setStats({sales,unpaid,cogs,orders:paid.length,customers,avgOrder,grossProfit:sales-cogs,prevSales,totalSold,avgItems,mtd,projection})
    setPayments(payArr)
    setTopItems(topArr.map(t=>({...t,max:maxQty})))
    setSlowItems(slowArr)
    setHourData(hourArr)
    setRecent(paid.slice(0,10))
    setLoading(false)
  }

  return {loading,stats,payments,topItems,slowItems,hourData,recent}
}

/* ─── Staff screen placeholder ─── */
function ScreenStaff() {
  return (
    <div style={{maxWidth:700}}>
      <div className="ow-card">
        <div style={{textAlign:"center",padding:"40px 0",color:"#94A3B8"}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{margin:"0 auto 12px",display:"block",opacity:0.4}}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <div style={{fontSize:14,fontWeight:600,color:"#334155",marginBottom:6}}>Laporan Karyawan</div>
          <div style={{fontSize:12}}>Segera hadir — absensi, shift, dan komisi per kasir</div>
        </div>
      </div>
    </div>
  )
}

/* ─── Products screen placeholder ─── */
function ScreenProducts({ topItems, slowItems }) {
  return (
    <div style={{maxWidth:800}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div className="ow-card">
          <div className="ow-card-title" style={{color:"#10B981"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
            Produk Terlaris
          </div>
          {topItems.length===0
            ? <div className="ow-empty">Belum ada data — aktifkan Demo</div>
            : topItems.map((it,i)=>(
              <div key={it.name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:11}}>
                <div style={{
                  width:24,height:24,borderRadius:"50%",flexShrink:0,
                  background:i===0?"#F59E0B":i===1?"#94A3B8":i===2?"#B45309":"#F1F5F9",
                  color:i<3?"#fff":"#64748B",
                  fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"
                }}>{i+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600,color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#0EA5E9",flexShrink:0,marginLeft:8}}>{it.qty}×</span>
                  </div>
                  <div className="ow-bar-track">
                    <div className="ow-bar-fill" style={{width:Math.round(it.qty/it.max*100)+"%",background:"#0EA5E9"}}/>
                  </div>
                  <div style={{fontSize:10,color:"#94A3B8",marginTop:3}}>{fmt(it.revenue)}</div>
                </div>
              </div>
            ))
          }
        </div>
        <div className="ow-card">
          <div className="ow-card-title" style={{color:"#F59E0B"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Produk Lambat / Tidak Bergerak
          </div>
          {slowItems.length===0
            ? <div style={{fontSize:12,color:"#94A3B8",padding:"8px 0"}}>Semua produk terjual dengan baik!</div>
            : slowItems.map(it=>(
              <div key={it.name} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"9px 12px",borderRadius:10,
                background:"#FFFBEB",border:"1px solid #FEF3C7",marginBottom:7
              }}>
                <div>
                  <div style={{fontSize:13,color:"#1E293B",fontWeight:600}}>{it.name}</div>
                  <div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>{fmt(it.revenue)} omset</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:12,background:"#FEF3C7",color:"#92400E"}}>
                    hanya {it.qty}×
                  </span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

/* ─── PIN screen ─── */
function PinScreen({ onAuth }) {
  const [pin, setPin] = useState("")
  const [err, setErr] = useState("")
  const push = d => {
    if(pin.length>=4) return
    const next = pin+d
    setPin(next)
    if(next.length===4) {
      if(next===OWNER_PIN) { setTimeout(()=>onAuth(),150) }
      else { setTimeout(()=>{ setPin(""); setErr("PIN salah, coba lagi") },400) }
    } else { setErr("") }
  }
  const del = () => { setPin(p=>p.slice(0,-1)); setErr("") }

  return (
    <div className="owner-pin">
      <div className="owner-pin-card">
        <div className="owner-pin-logo">P</div>
        <div className="owner-pin-title">Owner Dashboard</div>
        <div className="owner-pin-sub">PawonLoka · Masuk dengan PIN</div>
        <div className="owner-pin-dots">
          {[0,1,2,3].map(i=>(
            <div key={i} className={"owner-pin-dot"+(i<pin.length?" filled":"")}/>
          ))}
        </div>
        <div className="owner-pin-err">{err}</div>
        <div className="owner-pin-pad">
          {[1,2,3,4,5,6,7,8,9].map(n=>(
            <button key={n} className="owner-pin-key" onClick={()=>push(String(n))}>{n}</button>
          ))}
          <div/>
          <button className="owner-pin-key" onClick={()=>push("0")}>0</button>
          <button className="owner-pin-key" onClick={del} style={{fontSize:16}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{margin:"0 auto",display:"block"}}>
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
            </svg>
          </button>
        </div>
        <div style={{marginTop:20,fontSize:11,color:"rgba(255,255,255,0.2)"}}>Demo PIN: 1234</div>
        <a href="/" style={{display:"block",marginTop:12,fontSize:11,color:"rgba(255,255,255,0.25)",textDecoration:"none"}}>
          Kembali ke POS
        </a>
      </div>
    </div>
  )
}

/* ─── Root ─── */
export default function OwnerApp() {
  const [authed,  setAuthed]  = useState(false)
  const [screen,  setScreen]  = useState("dashboard")
  const [range,   setRange]   = useState("today")
  const [demo,    setDemo]    = useState(false)

  const { loading, stats, payments, topItems, slowItems, hourData, recent } = useOwnerData(range, demo)

  if (!authed) return <PinScreen onAuth={()=>setAuthed(true)}/>

  return (
    <div className="owner-app">
      {/* mobile topnav */}
      <div className="owner-topnav">
        <div className="owner-topnav-logo">PawonLoka Owner</div>
        <button onClick={()=>setDemo(d=>!d)} style={{
          padding:"5px 12px",borderRadius:8,border:"1.5px solid",fontSize:11,fontWeight:700,cursor:"pointer",
          background:demo?"rgba(14,165,233,0.2)":"transparent",
          borderColor:demo?"#0EA5E9":"rgba(255,255,255,0.2)",
          color:demo?"#7DD3FC":"rgba(255,255,255,0.5)"
        }}>{demo?"Demo ON":"Demo"}</button>
      </div>

      <div className="owner-shell">
        {/* sidebar */}
        <aside className="owner-sidebar">
          <div className="owner-sidebar-header">
            <div className="owner-sidebar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="owner-sidebar-name">PawonLoka</div>
            <div className="owner-sidebar-role">Owner View</div>
          </div>

          <nav className="owner-nav">
            <div className="owner-nav-section">Menu</div>
            {NAV.map(n=>(
              <button key={n.id} className={"owner-nav-item"+(screen===n.id?" active":"")}
                onClick={()=>setScreen(n.id)}>
                {n.icon}{n.label}
              </button>
            ))}

            <div className="owner-nav-section" style={{marginTop:8}}>Data</div>
            <button className={"owner-nav-item"+(demo?" active":"")} onClick={()=>setDemo(d=>!d)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
              {demo?"Demo: ON":"Demo: OFF"}
            </button>
          </nav>

          <div className="owner-sidebar-footer">
            <a href="/backoffice" style={{
              display:"block",padding:"9px 12px",borderRadius:10,
              background:"rgba(14,165,233,0.15)",
              border:"1px solid rgba(14,165,233,0.25)",
              color:"rgba(255,255,255,0.7)",
              fontSize:12,fontWeight:600,textAlign:"center",textDecoration:"none",
              marginBottom:6
            }}>
              Buka Backoffice
            </a>
            <button className="owner-logout-btn" onClick={()=>setAuthed(false)}>Keluar</button>
          </div>
        </aside>

        {/* main */}
        <main className="owner-main">
          <div className="owner-topbar">
            <div className="owner-topbar-left">
              <div className="owner-live-dot"/>
              <div className="owner-topbar-title">
                {screen==="dashboard" && "Dashboard"}
                {screen==="products"  && "Produk"}
                {screen==="staff"     && "Karyawan"}
                {screen==="cashflow"  && "Arus Kas"}
              </div>
            </div>
            <div className="owner-topbar-date">
              {new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </div>
          </div>

          <div className="owner-content">
            {screen==="dashboard" && (
              <ScreenDashboard
                range={range} setRange={setRange} loading={loading}
                stats={stats} hourData={hourData} payments={payments}
                topItems={topItems} slowItems={slowItems} recent={recent}
              />
            )}
            {screen==="products" && <ScreenProducts topItems={topItems} slowItems={slowItems}/>}
            {screen==="staff"    && <ScreenStaff/>}
            {screen==="cashflow" && <ScreenStaff/>}
          </div>
        </main>
      </div>
    </div>
  )
}
