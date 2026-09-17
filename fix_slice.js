import fs from 'fs'

const file = 'src/backoffice/components/StaffSubmissions.jsx'
let lines = fs.readFileSync(file, 'utf8').split('\n')

// Remove the injected SubmissionDetails component
const importIdx = lines.findIndex(l => l.startsWith('import React from \'react\'\nfunction SubmissionDetails'))
if (importIdx !== -1) {
  // It's multiline. Let's just git checkout instead and redo
}
