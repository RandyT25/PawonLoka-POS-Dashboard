import fs from 'fs'
import { execSync } from 'child_process'

const result = execSync('grep -r "new Date().toISOString().slice(0,10)" src/backoffice/components/inventory/ || true').toString();
const lines = result.split('\n').filter(Boolean);
if (lines.length > 0) {
  const filesToUpdate = [...new Set(lines.map(line => line.split(':')[0]))];
  for (const file of filesToUpdate) {
    let content = fs.readFileSync(file, 'utf8')
    if (!content.includes('getBusinessDateStr')) {
      content = content.replace(/import (.*) from 'react'/, "import $1 from 'react'\nimport { getBusinessDateStr } from '../../../shared/constants'")
    }
    content = content.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,10\)/g, 'getBusinessDateStr()')
    fs.writeFileSync(file, content)
    console.log(`Updated ${file}`)
  }
}
