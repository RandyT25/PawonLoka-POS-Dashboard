import fs from 'fs'

const path = 'src/pos/components/DailyStockModal.jsx'
let code = fs.readFileSync(path, 'utf8')

// Remove manualAdded state
code = code.replace(/const \[manualAdded, setManualAdded\] = useState\(\{\}\)\n/g, '')

// Remove manualAdded from expected_sisa logic in handleSubmit
code = code.replace(/const finalAdded = manualAdded\[item.id\] !== undefined \? \(parseFloat\(manualAdded\[item.id\]\) \|\| 0\) : item\.added_qty;\n\s*\/\/ expected_sisa MUST use auto_added_qty \(True System Math\), NOT finalAdded \(Nita's claim\)\!\n\s*\/\/ This ensures that if Nita fakes a \+Masuk to hide a shortage, the Teori still catches it\!\n\s*const expected_sisa = Math\.max\(0, item\.opening_stock \+ finalAdded \+ \(item\.adj_qty\|\|0\) - item\.sold_qty - item\.waste_qty - \(item\.production_qty\|\|0\)\);\n\s*const extraMasuk = finalAdded - item\.auto_added_qty;\n\s*if \(extraMasuk !== 0\) \{[\s\S]*?\}\n/g, 
`const expected_sisa = Math.max(0, item.opening_stock + item.auto_added_qty + (item.adj_qty||0) - item.sold_qty - item.waste_qty - (item.production_qty||0));\n      const finalAdded = item.auto_added_qty;\n`)

// Remove manualAdded from the render loop
code = code.replace(/const finalAddedForRender = manualAdded\[item.id\] !== undefined \? \(parseFloat\(manualAdded\[item.id\]\) \|\| 0\) : item\.added_qty;\n\s*const expected_sisa = Math\.max\(0, item\.opening_stock \+ finalAddedForRender \+ \(item\.adj_qty\|\|0\) - item\.sold_qty - item\.waste_qty - \(item\.production_qty\|\|0\)\);/g, 
`const expected_sisa = Math.max(0, item.opening_stock + item.auto_added_qty + (item.adj_qty||0) - item.sold_qty - item.waste_qty - (item.production_qty||0));`)

// Replace input with text
code = code.replace(/<td style=\{\{ \.\.\.styles\.td, textAlign: 'center', color: item\.added_qty > 0 \? '#00875A' : '#94A3B8' \}\}>\n\s*<input[\s\S]*?<\/td>/g, 
`<td style={{ ...styles.td, textAlign: 'center', color: item.auto_added_qty > 0 ? '#00875A' : '#94A3B8' }}>
                            {item.auto_added_qty > 0 ? \`+\${item.auto_added_qty}\` : '—'}
                          </td>`)

fs.writeFileSync(path, code)
