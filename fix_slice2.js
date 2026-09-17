import fs from 'fs'

const file = 'src/backoffice/components/StaffSubmissions.jsx'
let lines = fs.readFileSync(file, 'utf8').split('\n')

const extracted = lines.slice(941, 1242).join('\n')
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

const importIdx = lines.findIndex(l => l.startsWith('export default function StaffSubmissions'))
lines.splice(importIdx, 0, component)

let content = lines.join('\n')

content = content.replace('const [viewModal,   setViewModal]   = useState(null)', 'const [viewModal,   setViewModal]   = useState(null)\n  const [expandedId, setExpandedId] = useState(null)')

content = content.replace(/<button onClick=\{\(\)=>openViewModal\(s\)\} className="bo-btn bo-btn-ghost bo-btn-sm">View<\/button>/,
  '<button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="bo-btn bo-btn-ghost bo-btn-sm">{expandedId === s.id ? "Close" : "View"}</button>')

content = content.replace('<tr key={s.id} style={{ background: (isOrphanApproved(s) && !dismissedOrphanIds.has(s.id)) ? "var(--red-lt)"',
  '<React.Fragment key={s.id}>\n<tr onClick={(e) => { if(!e.target.closest("button") && !e.target.closest("input")) setExpandedId(expandedId === s.id ? null : s.id) }} style={{ cursor:"pointer", background: (isOrphanApproved(s) && !dismissedOrphanIds.has(s.id)) ? "var(--red-lt)"')

const trEndIdx = content.indexOf('<button onClick={()=>deleteSubmission(s)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ color:"var(--red)" }}>Delete</button>')
const afterTrEndIdx = content.indexOf('</tr>', trEndIdx)
const replacement = `</tr>
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
                  </React.Fragment>`

content = content.substring(0, afterTrEndIdx) + replacement + content.substring(afterTrEndIdx + 5)

fs.writeFileSync(file, content)
