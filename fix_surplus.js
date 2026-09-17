import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-06')
  for (const sub of subs) {
    let mod = false;
    sub.data.items = sub.data.items.map(it => {
      if (it.ingredient_id === 'ING-154') { // Sate Kambing
        console.log("Before:", it)
        it.opening_stock = 325;
        it.sold_qty = 29;
        it.expected_qty = 296;
        it.actual_qty = 296;
        it.diff_qty = 0;
        it.diff_value = 0;
        mod = true;
      }
      return it;
    })
    
    // recalculate total_variance_value
    let recalculated = 0;
    sub.data.items.forEach(it => {
      if (it.diff_value) recalculated += it.diff_value;
    })
    sub.data.total_variance_value = recalculated;
    
    if (mod) {
      await supabase.from('staff_submissions').update({ data: sub.data }).eq('id', sub.id)
      console.log("Fixed Sate Kambing Sep 6th surplus!")
    }
  }
}
run()
