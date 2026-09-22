import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: r14 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789402212788').single()
  const { data: moves } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-15')
  
  const handwrittenCounts = {
    'Sop Ayam (sub)': 13,
    'Ayam Bumbu Kuning (sub)': 34,
    'Sate Kambing (sub)': 146,
    'Sate Ayam (sub)': 101,
    'Ayam Taliwang (sub)': 12,
    'Telor': 114
  }

  let totalVariance = 0
  const items15 = r14.data.items.map(item14 => {
    const opening = item14.actual_qty !== null ? item14.actual_qty : item14.expected_qty
    let sold = 0, prod = 0, added = 0, waste = 0, adj = 0
    
    moves.filter(m => m.ingredient_id === item14.id).forEach(m => {
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
    let actual = handwrittenCounts[item14.name]
    if (actual === undefined) actual = expected
    
    const diff = actual - expected
    const diffVal = diff * (item14.cost_per_unit || 0)
    
    if (diffVal) totalVariance += diffVal
    else if (diff < 0) totalVariance -= (Math.abs(diff) * (item14.cost_per_unit || 0))
    
    return {
      ...item14,
      opening_stock: opening,
      added_qty: added,
      sold_qty: sold,
      waste_qty: waste,
      production_qty: prod,
      adj_qty: adj,
      expected_qty: expected,
      actual_qty: actual,
      diff_qty: diff,
      diff_value: diffVal
    }
  })
  
  const payload15 = {
    id: 'SS-RECON-1789488000000',
    type: 'daily_recon',
    staff_id: r14.staff_id, // NOT r14.data.staff_id
    shift_id: r14.shift_id,
    submitted_at: '2026-09-15T16:59:00.000Z',
    data: {
      items: items15,
      total_variance_value: totalVariance,
      date: '2026-09-15',
      staff_id: r14.staff_id,
      shift_id: r14.shift_id
    }
  }
  
  console.log("Inserting Sept 15...")
  const { error: insErr } = await supabase.from('staff_submissions').insert([payload15])
  if (insErr) {
    console.error("Insert error:", insErr)
    return
  }
  console.log("Insert success!")
}

run()
