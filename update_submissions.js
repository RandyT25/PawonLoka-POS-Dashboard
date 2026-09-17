import fs from 'fs'

const file = 'src/backoffice/components/StaffSubmissions.jsx'
let content = fs.readFileSync(file, 'utf8')

// We will inject a new component at the top to render submission details inline
const component = `
function SubmissionDetails({ viewModal, ingredients, updateReqItemSupplier, sendSupplierGroupWA }) {
  const fmt = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
  // We'll just grab the relevant snippet...
`

// Actually, I can just extract the render block between <div className="bo-modal-content"...> and <div className="bo-modal-actions"...> 
// and put it in a function. 
