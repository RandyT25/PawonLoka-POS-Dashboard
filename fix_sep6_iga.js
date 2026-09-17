import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  // 1. Insert Production Movements for Sept 6th
  const movs = [
    {
      id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
      ingredient_id: 'ING-200',
      ingredient_name: 'Tulang Iga Kambing',
      type: 'Production',
      qty: -3000,
      unit: 'gr',
      date: '2026-09-06',
      time: '23.59',
      ref: 'SS-MANUAL-SEP6',
      note: 'Auto-backfill missing ingredient deduction for Sop Iga (Nita typed +15 but no report)'
    },
    {
      id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
      ingredient_id: 'ING-201',
      ingredient_name: 'Tulang Kambing',
      type: 'Production',
      qty: -2000, // assuming 2kg like Sept 12
      unit: 'gr',
      date: '2026-09-06',
      time: '23.59',
      ref: 'SS-MANUAL-SEP6',
      note: 'Auto-backfill missing ingredient deduction for Sop Iga (Nita typed +15 but no report)'
    }
  ]
  
  await supabase.from('stock_movements').insert(movs)
  
  // 2. Fix the Sept 6th Recon JSON
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', '2026-09-06%')
  if(subs.length > 0) {
    const recon = subs[0]
    const items = recon.data.items
    
    // Fix Tulang Iga
    const iga = items.find(i => i.ingredient_id === 'ING-200')
    if (iga) {
      iga.production_qty = 3000
      iga.expected_qty = (iga.opening_stock || 0) + (iga.added_qty || 0) + (iga.adj_qty || 0) - (iga.sold_qty || 0) - (iga.waste_qty || 0) - iga.production_qty
      iga.diff_qty = iga.actual_qty - iga.expected_qty
      iga.diff_value = iga.diff_qty * (iga.cost_per_unit || 0)
    }
    
    // Fix Tulang Kambing
    const tulang = items.find(i => i.ingredient_id === 'ING-201')
    if (tulang) {
      tulang.production_qty = 2000
      tulang.expected_qty = (tulang.opening_stock || 0) + (tulang.added_qty || 0) + (tulang.adj_qty || 0) - (tulang.sold_qty || 0) - (tulang.waste_qty || 0) - tulang.production_qty
      tulang.diff_qty = tulang.actual_qty - tulang.expected_qty
      tulang.diff_value = tulang.diff_qty * (tulang.cost_per_unit || 0)
    }
    
    recon.data.total_variance_value = items.reduce((sum, i) => sum + i.diff_value, 0)
    
    await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', recon.id)
    console.log("Successfully updated Sept 6th Recon to reflect missing deductions!")
  }
}
run()
