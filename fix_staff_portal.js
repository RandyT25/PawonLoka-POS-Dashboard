import fs from 'fs'
const file = 'src/staff/StaffPortal.jsx'
let content = fs.readFileSync(file, 'utf8')
content = content.replace(
  /const item = outputIngredientId \? ingredients\.find\(i=>i\.id===outputIngredientId\) : null;/,
  "const item = outputIngredientId ? ingredientsById[outputIngredientId] : null;"
)
fs.writeFileSync(file, content)
