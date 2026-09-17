import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-07')
  const { data: todayMovements } = await supabase.from('stock_movements').select('ingredient_id, type, qty, date').eq('date', '2026-09-07')
  
  const production_deductions = {}
  const adjustments = {}
  const additions = {}
  
  todayMovements.forEach(m => {
    const qty = parseFloat(m.qty)
    const ingId = m.ingredient_id
    if (m.type === 'Purchase') additions[ingId] = (additions[ingId] || 0) + qty
    else if (m.type === 'Production') {
      if (qty > 0) additions[ingId] = (additions[ingId] || 0) + qty
      else production_deductions[ingId] = (production_deductions[ingId] || 0) + Math.abs(qty)
    }
    else if (m.type === 'Adjustment') {
      if (qty > 0) additions[ingId] = (additions[ingId] || 0) + qty
      else adjustments[ingId] = (adjustments[ingId] || 0) + Math.abs(qty)
    }
  })
  
  const sub = subs[0]
  let mod = false
  sub.data.items = sub.data.items.map(it => {
    const prodDed = production_deductions[it.ingredient_id] || 0
    const adj = adjustments[it.ingredient_id] || 0
    if (prodDed > 0 || adj > 0) {
      it.production_qty = prodDed
      it.adj_qty = adj
      mod = true
    } else {
      it.production_qty = 0
      it.adj_qty = 0
      mod = true
    }
    return it
  })
  
  if (mod) {
    await supabase.from('staff_submissions').update({ data: sub.data }).eq('id', sub.id)
    console.log("Fixed missing production_qty properties in Sep 7th")
  }
}
run()
