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
    
    // THE BUG WAS HERE: item14.id was undefined. Must use item14.ingredient_id
    moves.filter(m => m.ingredient_id === item14.ingredient_id).forEach(m => {
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
    
    // We should also clear out the copied sales_breakdown
    const sales_breakdown = Array.isArray(item14.sales_breakdown) ? [] : {}

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
      diff_value: diffVal,
      sales_breakdown: sales_breakdown
    }
  })
  
  const { data: r15 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789488000000').single()
  
  const payload15 = {
    ...r15.data,
    items: items15,
    total_variance_value: totalVariance
  }
  
  console.log("Fixing Sept 15...")
  const { error: updErr } = await supabase.from('staff_submissions').update({ data: payload15 }).eq('id', 'SS-RECON-1789488000000')
  if (updErr) {
    console.error("Update error:", updErr)
    return
  }
  
  console.log("Updating Sept 16...")
  const { data: r16 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789575677326').single()
  if (r16) {
    let newTotal16 = 0
    const items16 = r16.data.items.map(item16 => {
      const item15 = items15.find(i => i.ingredient_id === item16.ingredient_id)
      const opening = item15 ? (item15.actual_qty !== null ? item15.actual_qty : item15.expected_qty) : item16.opening_stock
      
      const expected = Math.max(0, opening + (item16.added_qty||0) + (item16.adj_qty||0) - (item16.sold_qty||0) - (item16.waste_qty||0) - (item16.production_qty||0))
      const diff = item16.actual_qty !== null ? (item16.actual_qty - expected) : 0
      const diffVal = diff * (item16.cost_per_unit || 0)
      
      if (diffVal) newTotal16 += diffVal
      else if (diff < 0) newTotal16 -= (Math.abs(diff) * (item16.cost_per_unit || 0))
      
      return {
        ...item16,
        opening_stock: opening,
        expected_qty: expected,
        diff_qty: diff,
        diff_value: diffVal
      }
    })
    
    await supabase.from('staff_submissions').update({
      data: {
        ...r16.data,
        items: items16,
        total_variance_value: newTotal16
      }
    }).eq('id', r16.id)
  }
  
  console.log("Fix success!")
}

run()
