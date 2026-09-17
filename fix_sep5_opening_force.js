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
    
    const tulang = items.find(i => i.ingredient_id === 'ING-201')
    if (tulang) {
      tulang.opening_stock = 5000 
      tulang.expected_qty = (tulang.opening_stock || 0) + (tulang.added_qty || 0) + (tulang.adj_qty || 0) - (tulang.sold_qty || 0) - (tulang.waste_qty || 0) - (tulang.production_qty || 0)
      tulang.actual_qty = tulang.expected_qty
      tulang.diff_qty = 0
      tulang.diff_value = 0
    }
    
    recon.data.total_variance_value = items.reduce((sum, i) => sum + (i.diff_value || 0), 0)
    
    const { error } = await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', recon.id)
    if (error) console.log("ERROR:", error)
    else console.log("UPDATED SEPT 5!")
  }
}
run()
