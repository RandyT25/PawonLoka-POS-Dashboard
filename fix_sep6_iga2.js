import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', '2026-09-06%')
  if(subs.length > 0) {
    const recon = subs[0]
    const items = recon.data.items
    
    // Fix Tulang Iga
    const iga = items.find(i => i.ingredient_id === 'ING-200')
    if (iga) {
      iga.actual_qty = 10000 // Awal 8k + 5k - 3k = 10k
      iga.diff_qty = iga.actual_qty - iga.expected_qty
      iga.diff_value = iga.diff_qty * (iga.cost_per_unit || 0)
    }
    
    // Fix Tulang Kambing
    const tulang = items.find(i => i.ingredient_id === 'ING-201')
    if (tulang) {
      tulang.actual_qty = 14000 // Awal 6k + 10k - 2k = 14k
      tulang.diff_qty = tulang.actual_qty - tulang.expected_qty
      tulang.diff_value = tulang.diff_qty * (tulang.cost_per_unit || 0)
    }
    
    recon.data.total_variance_value = items.reduce((sum, i) => sum + i.diff_value, 0)
    
    await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', recon.id)
    console.log("Successfully matched Sept 6th Actual counts to the new expected deductions!")
  }
}
run()
