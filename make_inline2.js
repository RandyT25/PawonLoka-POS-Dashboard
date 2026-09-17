import fs from 'fs'

const file = 'src/backoffice/components/StaffSubmissions.jsx'
let content = fs.readFileSync(file, 'utf8')

const lines = content.split('\n')
const extracted = lines.slice(941, 1241).join('\n')

const component = `
function SubmissionDetails({ viewModal, ingredients, dismissedOrphanIds, retryOrphan, dismissOrphan, processing, EXPECTED_MOVEMENT_TYPE, fmt, isOrphanApproved, updateReqItemSupplier, sendSupplierGroupWA }) {
  return (
    <div style={{ padding: "16px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--surface3)", margin: "8px 16px" }}>
      ${extracted}
    </div>
  )
}
`

// Insert component at the top after imports
const importIdx = lines.findIndex(l => l.startsWith('export default function StaffSubmissions'))
lines.splice(importIdx, 0, component)
content = lines.join('\n')

// Replace setViewModal with expandedId
content = content.replace('const [viewModal,   setViewModal]   = useState(null)', 'const [viewModal,   setViewModal]   = useState(null)\n  const [expandedId, setExpandedId] = useState(null)')

// Replace onClick="openViewModal" button with expand/collapse logic
content = content.replace(/<button onClick=\{\(\)=>openViewModal\(s\)\} className="bo-btn bo-btn-ghost bo-btn-sm">View<\/button>/g,
  '<button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="bo-btn bo-btn-ghost bo-btn-sm">{expandedId === s.id ? "Close" : "View"}</button>')

// Make the row clickable for expand
content = content.replace(/<tr key=\{s\.id\} style=\{\{ background:/g,
  '<tr key={s.id} onClick={(e) => { if(!e.target.closest("button") && !e.target.closest("input")) setExpandedId(expandedId === s.id ? null : s.id) }} style={{ cursor:"pointer", background:')

// Inject the expanded row
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
`
content = content.replace(/\n\s*<\/tr>\n\s*\)\n\s*\}\)\}/g, expandedRowTemplate + ')\n              })}')

fs.writeFileSync(file, content)
