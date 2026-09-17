import fs from 'fs'

let file = 'src/pos/components/DailyStockModal.jsx'
let content = fs.readFileSync(file, 'utf8')

content = content.replace(
  /const today = useMemo\(\(\) => \{\s*const d = new Date\(\)\s*return `\$\{d.getFullYear\(\)\}-\$\{String\(\w+\.getMonth\(\)\+1\)\.padStart\(2,'0'\)\}-\$\{String\(\w+\.getDate\(\)\)\.padStart\(2,'0'\)\}`\s*\}, \[\]\)/,
  `const today = useMemo(() => {
    const d = new Date();
    if (d.getHours() < 6) d.setDate(d.getDate() - 1);
    return \`\${d.getFullYear()}-\${String(d.getMonth()+1).padStart(2,'0')}-\${String(d.getDate()).padStart(2,'0')}\`
  }, [])`
)

content = content.replace(
  /'ING-170',\s*\/\/ Sop Iga Kambing \(sub\)/g,
  ""
)

fs.writeFileSync(file, content)
