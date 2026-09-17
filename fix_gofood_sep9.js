import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const targetDate = '2026-09-09'
  
  // 1. Delete the manual waste/adjustment from stock_movements
  await supabase.from('stock_movements')
    .delete()
    .eq('date', targetDate)
    .ilike('notes', '%GoFood Tongseng%')
    
  // 2. Update the Sept 9th Daily Recon JSON payload
  const { data: subs } = await supabase.from('staff_submissions')
    .select('*')
    .eq('type', 'daily_recon')
    .eq('data->>date', targetDate)
    
  if (subs && subs.length > 0) {
    let sub = subs[0]
    let modified = false
    
    sub.data.items = sub.data.items.map(it => {
      if (it.name === 'Sate Kambing (sub)') {
        it.waste_qty = 0
        it.adj_qty = 0
        it.expected_qty = 282
        // actual_qty stays 279, so diff is -3
        it.diff_qty = -3
        modified = true
      }
      return it
    })
    
    if (modified) {
      await supabase.from('staff_submissions').update({ data: sub.data }).eq('id', sub.id)
      console.log("Reverted Sate Kambing manual adjustment for Sept 9th. It will now show a -3 discrepancy.")
    }
  }
}
run()
