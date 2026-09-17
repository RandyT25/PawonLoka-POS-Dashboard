import fs from 'fs'

const file = 'src/backoffice/components/inventory/InvDailyRecon.jsx'

let lines = fs.readFileSync(file, 'utf8').split('\n')

const origLines = fs.readFileSync('detail_modal.jsx', 'utf8').split('\n')
const extracted = origLines.slice(15, 112).join('\n')

const component = `
import React from 'react'
function DailyReconDetails({ viewDetail, fmt }) {
  return (
    <div style={{ padding: "16px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--surface3)", margin: "8px 16px" }}>
      ${extracted}
    </div>
  )
}
`

const importIdx = lines.findIndex(l => l.startsWith('export default function InvDailyRecon'))
lines.splice(importIdx, 0, component)

let content = lines.join('\n')

content = content.replace('const [viewDetail, setViewDetail] = useState(null)', 'const [viewDetail, setViewDetail] = useState(null)\n  const [expandedId, setExpandedId] = useState(null)')

content = content.replace(/<button onClick=\{\(\) => setViewDetail\(sub\)\} className="bo-btn bo-btn-ghost bo-btn-sm" style=\{\{ color: "var\(--brand\)" \}\}>\s*Lihat Detail\s*<\/button>/,
  '<button onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)} className="bo-btn bo-btn-ghost bo-btn-sm" style={{ color: "var(--brand)" }}>{expandedId === sub.id ? "Tutup Detail" : "Lihat Detail"}</button>')

content = content.replace(/<tr key=\{sub\.id\} style=\{\{ background: sub\.status === "pending"/,
  '<React.Fragment key={sub.id}>\n<tr onClick={(e) => { if(!e.target.closest("button") && !e.target.closest("input")) setExpandedId(expandedId === sub.id ? null : sub.id) }} style={{ cursor:"pointer", background: sub.status === "pending"')

const trEndIdx = content.indexOf('<button\n                            onClick={() => handleDelete(sub.id)}\n                            disabled={processingId === sub.id}\n                            className="bo-btn bo-btn-ghost bo-btn-sm" style={{ color: "var(--red)" }}\n                          >\n                            Hapus\n                          </button>')
const afterTrEndIdx = content.indexOf('</tr>', trEndIdx)
const replacement = `</tr>
                  {expandedId === sub.id && (
                    <tr style={{ background: "var(--surface2)" }}>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <DailyReconDetails 
                          viewDetail={sub} 
                          fmt={fmt}
                        />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>`

content = content.substring(0, afterTrEndIdx) + replacement + content.substring(afterTrEndIdx + 5)

// Remove Sop Iga Kambing
content = content.replace(/.*'ING-170',\s*\/\/\s*Sop Iga Kambing \(sub\).*\n/, '')

fs.writeFileSync(file, content)
