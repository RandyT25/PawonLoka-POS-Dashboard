import fs from 'fs'

const file = 'src/backoffice/components/StaffSubmissions.jsx'
let lines = fs.readFileSync(file, 'utf8').split('\n')

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

const importIdx = lines.findIndex(l => l.startsWith('export default function StaffSubmissions'))
lines.splice(importIdx, 0, component)

let content = lines.join('\n')
fs.writeFileSync('test_staff.jsx', content)
