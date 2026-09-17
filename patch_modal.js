import fs from 'fs'

const path = 'src/pos/components/DailyStockModal.jsx'
let code = fs.readFileSync(path, 'utf8')

// Fix the expected_sisa logic and restore the auto-injection
code = code.replace(
  /const expected_sisa = Math\.max\(0, item\.opening_stock \+ item\.auto_added_qty \+ \(item\.adj_qty\|\|0\) - item\.sold_qty - item\.waste_qty - \(item\.production_qty\|\|0\)\);/,
  `const expected_sisa = Math.max(0, item.opening_stock + finalAdded + (item.adj_qty||0) - item.sold_qty - item.waste_qty - (item.production_qty||0));`
)

code = code.replace(
  /\/\/ REMOVED AUTO-INJECTION: We no longer magically create stock movements based on Nita's input\.\n\s*\/\/ Her input is just a CLAIM that will be cross-checked against true system production\.\n\s*const extraMasuk = finalAdded - item\.auto_added_qty;\n/,
  `const extraMasuk = finalAdded - item.auto_added_qty;
      if (extraMasuk !== 0) {
        movementsToInsert.push({
          id: "MOV-" + Date.now() + "-" + Math.random().toString(36).slice(2,6),
          type: extraMasuk > 0 ? "PO Receive" : "Adjustment",
          ingredient_id: item.id,
          ingredient_name: item.name,
          qty: extraMasuk,
          unit: item.unit,
          note: "Manual Restock input from Daily Audit",
          date: getBusinessDateStr(),
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.'),
          actor: staff?.name || 'System'
        });
      }`
)

fs.writeFileSync(path, code)
