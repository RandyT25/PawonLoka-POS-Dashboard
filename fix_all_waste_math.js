import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // 1. Move Meldy's waste to Sept 15
  await supabase.from('stock_movements').update({ date: '2026-09-15' }).eq('id', 'MOV-1789645332561-jofq')
  console.log("Moved Meldy's waste to Sept 15")

  // We have the 14th, 15th, and 16th reports.
  // We need to rebuild 15th and 16th based on actual stock_movements!
  const { data: r14 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789402212788').single()
  const { data: r15 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789488000000').single()
  const { data: r16 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789575677326').single()

  const { data: moves15 } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-15')
  const { data: moves16 } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-16')

  // Rebuild 15
  let total15 = 0
  const items15 = r15.data.items.map(item => {
    const opening = r14.data.items.find(i => i.ingredient_id === item.ingredient_id)?.actual_qty || item.opening_stock
    let sold = 0, prod = 0, added = 0, waste = 0, adj = 0
    moves15.filter(m => m.ingredient_id === item.ingredient_id).forEach(m => {
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
    
    const expected = Math.max(0, opening + added + adj - sold - waste - prod)
    const diff = item.actual_qty - expected
    const diffVal = diff * (item.cost_per_unit || 0)
    
    if (diffVal) total15 += diffVal
    else if (diff < 0) total15 -= (Math.abs(diff) * (item.cost_per_unit || 0))
    
    return { ...item, opening_stock: opening, added_qty: added, sold_qty: sold, waste_qty: waste, production_qty: prod, expected_qty: expected, diff_qty: diff, diff_value: diffVal }
  })
  
  await supabase.from('staff_submissions').update({ data: { ...r15.data, items: items15, total_variance_value: total15 } }).eq('id', r15.id)
  console.log("Updated Sept 15")

  // Rebuild 16
  let total16 = 0
  const items16 = r16.data.items.map(item => {
    const opening = items15.find(i => i.ingredient_id === item.ingredient_id)?.actual_qty || item.opening_stock
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
    
    const expected = Math.max(0, opening + added + adj - sold - waste - prod)
    const diff = item.actual_qty - expected
    const diffVal = diff * (item.cost_per_unit || 0)
    
    if (diffVal) total16 += diffVal
    else if (diff < 0) total16 -= (Math.abs(diff) * (item.cost_per_unit || 0))
    
    return { ...item, opening_stock: opening, added_qty: added, sold_qty: sold, waste_qty: waste, production_qty: prod, expected_qty: expected, diff_qty: diff, diff_value: diffVal }
  })

  await supabase.from('staff_submissions').update({ data: { ...r16.data, items: items16, total_variance_value: total16 } }).eq('id', r16.id)
  console.log("Updated Sept 16")
}

run()
