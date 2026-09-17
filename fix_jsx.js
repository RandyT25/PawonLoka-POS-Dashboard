import fs from 'fs'

const files = [
  'src/backoffice/components/SalesReport.jsx',
  'src/backoffice/components/StaffSubmissions.jsx'
]

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  if (!content.includes('import React')) {
    content = content.replace(/import .* from 'react'/, "$&\nimport React from 'react'")
  }
  
  if (file.includes('SalesReport')) {
    content = content.replace(/<tr key=\{r.date\}/, '<React.Fragment key={r.date}><tr')
    content = content.replace(/<\/tr>\n\s*\{expandedDate === r.date/g, '</tr>\n                    {expandedDate === r.date')
    content = content.replace(/<\/tr>\n\s*\)\}\n\s*\)/g, '</tr>\n                    )}\n                  </React.Fragment>\n                  )')
  } else if (file.includes('StaffSubmissions')) {
    content = content.replace(/<tr key=\{s.id\}/, '<React.Fragment key={s.id}><tr')
    content = content.replace(/<\/tr>\n\s*\{expandedId === s.id/g, '</tr>\n                  {expandedId === s.id')
    content = content.replace(/<\/tr>\n\s*\)\}\n\s*\)\n\s*\}\)\}/g, '</tr>\n                  )}\n                  </React.Fragment>\n                )\n              })}')
  }
  fs.writeFileSync(file, content)
}
