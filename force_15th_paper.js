import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: r15 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789488000000').single()
  const { data: r16 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789575677326').single()
  const { data: moves16 } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-16')
  
  const paper = {
    'Sop Ayam (sub)': { awal: 2, prod: 12, sold: 1, waste: 0, teori: 13, fisik: 13 },
    'Ayam Bumbu Kuning (sub)': { awal: 38, prod: 0, sold: 3, waste: 1, teori: 34, fisik: 34 },
    'Sate Kambing (sub)': { awal: 146, prod: 0, sold: 0, waste: 0, teori: 146, fisik: 146 },
    'Sate Ayam (sub)': { awal: 111, prod: 0, sold: 10, waste: 0, teori: 101, fisik: 101 },
    'Ayam Taliwang (sub)': { awal: 15, prod: 0, sold: 3, waste: 0, teori: 12, fisik: 12 },
    'Telor': { awal: 122, prod: 0, sold: 8, waste: 0, teori: 114, fisik: 114 }
  }

  let total15 = 0
  const items15 = r15.data.items.map(item => {
    if (paper[item.name]) {
      const p = paper[item.name]
      return {
        ...item,
        opening_stock: p.awal,
        production_qty: p.prod,
        added_qty: p.prod, // treating prod as added
        sold_qty: p.sold,
        waste_qty: p.waste,
        adj_qty: 0,
        expected_qty: p.teori,
        actual_qty: p.fisik,
        diff_qty: 0,
        diff_value: 0
      }
    }
    return item // leave others as is
  })

  // update 15
  await supabase.from('staff_submissions').update({ data: { ...r15.data, items: items15, total_variance_value: total15 } }).eq('id', r15.id)

  // rebuild 16 based on the new 15
  let total16 = 0
  const items16 = r16.data.items.map(item => {
    const item15 = items15.find(i => i.ingredient_id === item.ingredient_id)
    const opening = item15 ? item15.actual_qty : item.opening_stock
    
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
  console.log("Forced Sept 15 paper records & updated Sept 16!")
}
run()
