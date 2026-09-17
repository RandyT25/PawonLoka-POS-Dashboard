import fs from 'fs'

const file = 'src/backoffice/components/inventory/InvDailyRecon.jsx'
let content = fs.readFileSync(file, 'utf8')

if (!content.includes('import React')) {
  content = content.replace(/import .* from 'react'/, "$&\nimport React from 'react'")
}

// 1. replace setViewDetail with expandedId
content = content.replace('const [viewDetail, setViewDetail] = useState(null)', 'const [viewDetail, setViewDetail] = useState(null)\n  const [expandedId, setExpandedId] = useState(null)')

// 2. replace onClick View button (Lihat Detail)
content = content.replace(/<button onClick=\{\(\) => setViewDetail\(sub\)\} className="bo-btn bo-btn-ghost bo-btn-sm" style=\{\{ color: "var\(--brand\)" \}\}>\s*Lihat Detail\s*<\/button>/,
  '<button onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ color: "var(--brand)" }}>{expandedId === sub.id ? "Tutup Detail" : "Lihat Detail"}</button>')

// 3. Make tr clickable and wrap in React.Fragment
content = content.replace(/<tr key=\{sub.id\} style=\{\{ background: sub.status === "pending"/,
  '<React.Fragment key={sub.id}>\n<tr onClick={(e) => { if(!e.target.closest("button") && !e.target.closest("input")) setExpandedId(expandedId === sub.id ? null : sub.id) }} style={{ cursor:"pointer", background: sub.status === "pending"')

// 4. Find the END of the `filteredSubmissions.map` return.
// The structure is:
//                      </div>
//                    </td>
//                  </tr>
//                )
//              })}

const lines = content.split('\n')
const endModalBody = lines.indexOf('              </table>') + 33 // Just getting a rough slice of the modal to put inside SubmissionDetails... wait, this is getting complex again.
