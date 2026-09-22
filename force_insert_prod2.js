import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const prodDate = '2026-09-16'
  const time = Date.now()
  const moves = [
    { id: `MOV-${time}-1`, type: 'Production', ingredient_id: 'ING-046', ingredient_name: 'Daging Kambing', qty: -4000, unit: 'gr', ref: 'PROD-AUTO', note: 'Auto-fill forgotten production', date: prodDate, time: '12.00', actor: 'System' },
    { id: `MOV-${time}-2`, type: 'Production', ingredient_id: 'ING-201', ingredient_name: 'Tulang Kambing', qty: -2000, unit: 'gr', ref: 'PROD-AUTO', note: 'Auto-fill forgotten production', date: prodDate, time: '12.00', actor: 'System' },
    { id: `MOV-${time}-3`, type: 'Production', ingredient_id: 'ING-154', ingredient_name: 'Sate Kambing (sub)', qty: 228, unit: 'pcs', ref: 'PROD-AUTO', note: 'Auto-fill forgotten production', date: prodDate, time: '12.00', actor: 'System' }
  ]
  const { error } = await supabase.from('stock_movements').insert(moves)
  if (error) console.error("Insert error:", error)
  else console.log("Insert success")
  
  // Rebuild 16th
  const { data: r16 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789575677326').single()
  const { data: moves16 } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-16')
  
  let total16 = 0
  const items16 = r16.data.items.map(item => {
    let sold = 0, prod = 0, added = 0, waste = 0, adj = 0
    moves16.filter(m => m.ingredient_id === item.ingredient_id).forEach(m => {
      if (m.type === 'Sale' && m.qty < 0) sold += Math.abs(m.qty)
      else if (m.type === 'Waste' && m.qty < 0) waste += Math.abs(m.qty)
      else if (m.type === 'Production') {
          if (m.qty < 0) prod += Math.abs(m.qty)
          if (m.qty > 0) added += m.qty
      }
      else if (m.type === 'Purchase' && m.qty > 0) added += m.qty
      else if (m.type === 'Adjustment') {
          if (m.qty < 0) waste += Math.abs(m.qty)
          else added += m.qty
      }
    })
    
    const expected = Math.max(0, item.opening_stock + added + adj - sold - waste - prod)
    const diff = item.actual_qty - expected
    const diffVal = diff * (item.cost_per_unit || 0)
    
    if (diffVal) total16 += diffVal
    else if (diff < 0) total16 -= (Math.abs(diff) * (item.cost_per_unit || 0))
    
    return { ...item, added_qty: added, sold_qty: sold, waste_qty: waste, production_qty: prod, expected_qty: expected, diff_qty: diff, diff_value: diffVal }
  })

  const { error: updErr } = await supabase.from('staff_submissions').update({ data: { ...r16.data, items: items16, total_variance_value: total16 } }).eq('id', r16.id)
  if (updErr) console.log(updErr)
  else console.log("Updated Sept 16!")
}
run()
