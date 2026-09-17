import fs from 'fs'

const file = 'src/backoffice/components/inventory/InvDailyRecon.jsx'
let content = fs.readFileSync(file, 'utf8')

content = content.replace(/.*'ING-170',\s*\/\/\s*Sop Iga Kambing \(sub\).*\n/, '')

fs.writeFileSync(file, content)
