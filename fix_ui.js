import fs from 'fs'

let file = 'src/backoffice/components/SalesReport.jsx'
let content = fs.readFileSync(file, 'utf8')

if (!content.includes('import React')) {
  content = content.replace(/import .* from 'react'/, "$&\nimport React from 'react'")
}

// Add expandedDate state
content = content.replace('const [customDateTo,setCustomDateTo]= useState(today())', 
  'const [customDateTo,setCustomDateTo]= useState(today())\n  const [expandedDate, setExpandedDate] = useState(null)')

// Store the actual orders in the map
content = content.replace('if (!map[d]) map[d] = { date:d, orders:0, subtotal:0, tax:0, discount:0, total:0 }',
  'if (!map[d]) map[d] = { date:d, orders:0, subtotal:0, tax:0, discount:0, total:0, orderList: [] }')
content = content.replace('map[d].total += parseFloat(o.total || 0)',
  'map[d].total += parseFloat(o.total || 0)\n      map[d].orderList.push(o)')

// Add onClick to tr
content = content.replace('<tr key={r.date}>',
  '<React.Fragment key={r.date}>\n<tr onClick={() => setExpandedDate(expandedDate === r.date ? null : r.date)} style={{ cursor: "pointer", background: expandedDate === r.date ? "var(--surface2)" : undefined }}>')

// Add expanded content below tr
const expandedTemplate = `
                    </tr>
                    {expandedDate === r.date && (
                      <tr style={{ background: "var(--surface2)" }}>
                        <td colSpan={7} style={{ padding: "16px 24px" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink4)" }}>Orders on {new Date(r.date+"T12:00:00").toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
                          <table className="bo-table" style={{ background: "#fff", border: "1px solid var(--surface3)", borderRadius: "var(--r)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                            <thead>
                              <tr>
                                <th>Order ID</th>
                                <th>Items</th>
                                <th style={{ textAlign:"right" }}>Subtotal</th>
                                <th style={{ textAlign:"right" }}>Tax</th>
                                <th style={{ textAlign:"right" }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.orderList.map(o => (
                                <tr key={o.id}>
                                  <td style={{ fontFamily: "monospace" }}>#{o.id.slice(-6)}</td>
                                  <td style={{ fontSize: 12, color: "var(--ink5)" }}>{(o.items || []).map(i => \`\${i.qty}x \${i.name}\`).join(", ")}</td>
                                  <td style={{ textAlign:"right" }}>{fmt(o.subtotal)}</td>
                                  <td style={{ textAlign:"right" }}>{fmt(o.tax)}</td>
                                  <td style={{ textAlign:"right", fontWeight: 600 }}>{fmt(o.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
`
content = content.replace('</tr>\n                  ))}', expandedTemplate + '                  ))}')

fs.writeFileSync(file, content)


// STAFF SUBMISSIONS
file = 'src/backoffice/components/StaffSubmissions.jsx'
content = fs.readFileSync(file, 'utf8')

if (!content.includes('import React')) {
  content = content.replace(/import .* from 'react'/, "$&\nimport React from 'react'")
}

const lines = content.split('\n')
const extracted = lines.slice(931, 1241).join('\n')

const component = `
function SubmissionDetails({ viewModal, ingredients, dismissedOrphanIds, retryOrphan, dismissOrphan, processing, EXPECTED_MOVEMENT_TYPE, fmt, isOrphanApproved, updateReqItemSupplier, sendSupplierGroupWA }) {
  return (
    <div style={{ padding: "16px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--surface3)", margin: "8px 16px" }}>
      ${extracted}
    </div>
  )
}
`

const importIdx = lines.findIndex(l => l.startsWith('export default function StaffSubmissions'))
lines.splice(importIdx, 0, component)
content = lines.join('\n')

content = content.replace('const [viewModal,   setViewModal]   = useState(null)', 'const [viewModal,   setViewModal]   = useState(null)\n  const [expandedId, setExpandedId] = useState(null)')

content = content.replace(/<button onClick=\{\(\)=>openViewModal\(s\)\} className="bo-btn bo-btn-ghost bo-btn-sm">View<\/button>/g,
  '<button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="bo-btn bo-btn-ghost bo-btn-sm">{expandedId === s.id ? "Close" : "View"}</button>')

content = content.replace(/<tr key=\{s\.id\} style=\{\{ background:/g,
  '<React.Fragment key={s.id}>\n<tr onClick={(e) => { if(!e.target.closest("button") && !e.target.closest("input")) setExpandedId(expandedId === s.id ? null : s.id) }} style={{ cursor:"pointer", background:')

const expandedRowTemplate = `
                  </tr>
                  {expandedId === s.id && (
                    <tr style={{ background: "var(--surface2)" }}>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <SubmissionDetails 
                          viewModal={s} 
                          ingredients={ingredients} 
                          dismissedOrphanIds={dismissedOrphanIds}
                          retryOrphan={retryOrphan}
                          dismissOrphan={dismissOrphan}
                          processing={processing}
                          EXPECTED_MOVEMENT_TYPE={EXPECTED_MOVEMENT_TYPE}
                          fmt={fmt}
                          isOrphanApproved={isOrphanApproved}
                          updateReqItemSupplier={updateReqItemSupplier}
                          sendSupplierGroupWA={sendSupplierGroupWA}
                        />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
`
content = content.replace(/\n\s*<\/tr>\n\s*\)\n\s*\}\)\}/g, expandedRowTemplate + '\n                )\n              })}')

fs.writeFileSync(file, content)
