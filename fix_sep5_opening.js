import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', '2026-09-05%')
  if (subs.length > 0) {
    let recon = subs[0]
    let items = recon.data.items
    
    // Fix Tulang Kambing opening stock
    const tulang = items.find(i => i.ingredient_id === 'ING-201')
    if (tulang) {
      tulang.opening_stock = 5000 // 8000 (Sept 1) - 3000 (Sept 3)
      tulang.expected_qty = (tulang.opening_stock || 0) + (tulang.added_qty || 0) + (tulang.adj_qty || 0) - (tulang.sold_qty || 0) - (tulang.waste_qty || 0) - (tulang.production_qty || 0)
      tulang.actual_qty = tulang.expected_qty
      tulang.diff_qty = 0
      tulang.diff_value = 0
    }

    // Fix Sop Tulang Kambing opening stock
    const sop = items.find(i => i.ingredient_id === 'ING-1781533071195')
    if (sop) {
      sop.opening_stock = 20 // From Sept 3
      sop.expected_qty = (sop.opening_stock || 0) + (sop.added_qty || 0) + (sop.adj_qty || 0) - (sop.sold_qty || 0) - (sop.waste_qty || 0) - (sop.production_qty || 0)
      sop.actual_qty = sop.expected_qty
      sop.diff_qty = 0
      sop.diff_value = 0
    }

    await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', recon.id)
    console.log("Fixed Sept 5th opening stocks!")
  }
}
run()
