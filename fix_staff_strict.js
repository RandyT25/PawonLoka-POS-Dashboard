import fs from 'fs'

const file = 'src/backoffice/components/StaffSubmissions.jsx'
let lines = fs.readFileSync(file, 'utf8').split('\n')

// Extract the modal content
const extracted = lines.slice(941, 1241).join('\n')
const component = `
import React from 'react'
function SubmissionDetails({ viewModal, ingredients, dismissedOrphanIds, retryOrphan, dismissOrphan, processing, EXPECTED_MOVEMENT_TYPE, fmt, isOrphanApproved, updateReqItemSupplier, sendSupplierGroupWA }) {
  return (
    <div style={{ padding: "16px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--surface3)", margin: "8px 16px" }}>
      ${extracted}
    </div>
  )
}
`

// Insert at top
const importIdx = lines.findIndex(l => l.startsWith('export default function StaffSubmissions'))
lines.splice(importIdx, 0, component)

let content = lines.join('\n')

// 1. replace setViewModal
content = content.replace('const [viewModal,   setViewModal]   = useState(null)', 'const [viewModal,   setViewModal]   = useState(null)\n  const [expandedId, setExpandedId] = useState(null)')

// 2. replace onClick View button
content = content.replace(/<button onClick=\{\(\)=>openViewModal\(s\)\} className="bo-btn bo-btn-ghost bo-btn-sm">View<\/button>/,
  '<button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="bo-btn bo-btn-ghost bo-btn-sm">{expandedId === s.id ? "Close" : "View"}</button>')

// 3. Make tr clickable and wrap in React.Fragment. There is only ONE `<tr key={s.id}` in the file!
content = content.replace(/<tr key=\{s\.id\} style=\{\{ background:/,
  '<React.Fragment key={s.id}>\n<tr onClick={(e) => { if(!e.target.closest("button") && !e.target.closest("input")) setExpandedId(expandedId === s.id ? null : s.id) }} style={{ cursor:"pointer", background:')

// 4. Find the END of the `filtered.map` return.
// The structure is:
//                      </div>
//                    </td>
//                  </tr>
//                )
//              })}
// We can just replace exactly that!
content = content.replace(/(\s*)<\/td>\n(\s*)<\/tr>\n(\s*)\)\n(\s*)\}\)\}/,
`$1</td>
$2</tr>
$2{expandedId === s.id && (
$2  <tr style={{ background: "var(--surface2)" }}>
$2    <td colSpan={8} style={{ padding: 0 }}>
$2      <SubmissionDetails 
$2        viewModal={s} 
$2        ingredients={ingredients} 
$2        dismissedOrphanIds={dismissedOrphanIds}
$2        retryOrphan={retryOrphan}
$2        dismissOrphan={dismissOrphan}
$2        processing={processing}
$2        EXPECTED_MOVEMENT_TYPE={EXPECTED_MOVEMENT_TYPE}
$2        fmt={fmt}
$2        isOrphanApproved={isOrphanApproved}
$2        updateReqItemSupplier={updateReqItemSupplier}
$2        sendSupplierGroupWA={sendSupplierGroupWA}
$2      />
$2    </td>
$2  </tr>
$2)}
$2</React.Fragment>
$3)
$4})}`)

fs.writeFileSync(file, content)


// Now for SalesReport.jsx
const salesFile = 'src/backoffice/components/SalesReport.jsx'
let salesLines = fs.readFileSync(salesFile, 'utf8').split('\n')
let salesContent = salesLines.join('\n')

if (!salesContent.includes('import React')) {
  salesContent = salesContent.replace(/import .* from 'react'/, "$&\nimport React from 'react'")
}

salesContent = salesContent.replace('const [customDateTo,setCustomDateTo]= useState(today())', 
  'const [customDateTo,setCustomDateTo]= useState(today())\n  const [expandedDate, setExpandedDate] = useState(null)')

salesContent = salesContent.replace('if (!map[d]) map[d] = { date:d, orders:0, subtotal:0, tax:0, discount:0, total:0 }',
  'if (!map[d]) map[d] = { date:d, orders:0, subtotal:0, tax:0, discount:0, total:0, orderList: [] }')
salesContent = salesContent.replace('map[d].total += parseFloat(o.total || 0)',
  'map[d].total += parseFloat(o.total || 0)\n      map[d].orderList.push(o)')

// The tr is exactly `<tr key={r.date}>`
salesContent = salesContent.replace(/<tr key=\{r\.date\}>/,
  '<React.Fragment key={r.date}>\n<tr onClick={() => setExpandedDate(expandedDate === r.date ? null : r.date)} style={{ cursor: "pointer", background: expandedDate === r.date ? "var(--surface2)" : undefined }}>')

// The end is:
//                    </tr>
//                  ))}
salesContent = salesContent.replace(/(\s*)<\/tr>\n(\s*)\)\)\}/,
`$1</tr>
$1{expandedDate === r.date && (
$1  <tr style={{ background: "var(--surface2)" }}>
$1    <td colSpan={7} style={{ padding: "16px 24px" }}>
$1      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink4)" }}>Orders on {new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
$1      <table className="bo-table" style={{ background: "#fff", border: "1px solid var(--surface3)", borderRadius: "var(--r)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
$1        <thead>
$1          <tr>
$1            <th>Order ID</th>
$1            <th>Items</th>
$1            <th style={{ textAlign:"right" }}>Subtotal</th>
$1            <th style={{ textAlign:"right" }}>Tax</th>
$1            <th style={{ textAlign:"right" }}>Total</th>
$1          </tr>
$1        </thead>
$1        <tbody>
$1          {r.orderList.map(o => (
$1            <tr key={o.id}>
$1              <td style={{ fontFamily: "monospace" }}>#{o.id.slice(-6)}</td>
$1              <td style={{ fontSize: 12, color: "var(--ink5)" }}>{(o.items || []).map(i => \`\${i.qty}x \${i.name}\`).join(", ")}</td>
$1              <td style={{ textAlign:"right" }}>{fmt(o.subtotal)}</td>
$1              <td style={{ textAlign:"right" }}>{fmt(o.tax)}</td>
$1              <td style={{ textAlign:"right", fontWeight: 600 }}>{fmt(o.total)}</td>
$1            </tr>
$1          ))}
$1        </tbody>
$1      </table>
$1    </td>
$1  </tr>
$1)}
$1</React.Fragment>
$2))}`)

fs.writeFileSync(salesFile, salesContent)
