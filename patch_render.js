import fs from 'fs'

const path = 'src/pos/components/DailyStockModal.jsx'
let code = fs.readFileSync(path, 'utf8')

code = code.replace(
  /const expected_sisa = Math\.max\(0, item\.opening_stock \+ item\.auto_added_qty \+ \(item\.adj_qty\|\|0\) - item\.sold_qty - item\.waste_qty - \(item\.production_qty\|\|0\)\);/,
  `const finalAddedForRender = manualAdded[item.id] !== undefined ? (parseFloat(manualAdded[item.id]) || 0) : item.added_qty;
                      const expected_sisa = Math.max(0, item.opening_stock + finalAddedForRender + (item.adj_qty||0) - item.sold_qty - item.waste_qty - (item.production_qty||0));`
)

fs.writeFileSync(path, code)
