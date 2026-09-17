import fs from 'fs'

const files = [
  'src/staff/components/ProductionForm.jsx',
  'src/staff/components/WasteForm.jsx',
  'src/staff/components/ConsumptionForm.jsx',
  'src/staff/components/RequisitionForm.jsx',
  'src/staff/components/OpnameForm.jsx',
  'src/staff/StaffPortal.jsx'
]

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  // For files in staff/components, we might need to import getBusinessDateStr
  if (content.includes('new Date().toISOString().slice(0,10)')) {
    if (!content.includes('getBusinessDateStr')) {
      if (file.includes('components')) {
        content = content.replace(/import .* from 'react'/, "$&\nimport { getBusinessDateStr } from '../../shared/constants'")
      } else {
        content = content.replace(/import .* from 'react'/, "$&\nimport { getBusinessDateStr } from '../shared/constants'")
      }
    }
    content = content.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,10\)/g, 'getBusinessDateStr()')
    fs.writeFileSync(file, content)
    console.log(`Updated ${file}`)
  }
}
