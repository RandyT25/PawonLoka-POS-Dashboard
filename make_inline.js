import fs from 'fs'

const file = 'src/backoffice/components/StaffSubmissions.jsx'
let lines = fs.readFileSync(file, 'utf8').split('\n')

const extracted = lines.slice(941, 1241).join('\n')
const component = `
function SubmissionDetails({ viewModal, ingredients, dismissedOrphanIds, retryOrphan, dismissOrphan, processing, EXPECTED_MOVEMENT_TYPE, fmt, isOrphanApproved, updateReqItemSupplier, sendSupplierGroupWA }) {
  return (
    <div style={{ padding: "16px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--surface3)", margin: "8px 0" }}>
      ${extracted}
    </div>
  )
}
`

// Replace the original modal with nothing, wait, let's keep the modal just in case, or just replace the modal completely?
// Actually, let's just replace the whole file content!
