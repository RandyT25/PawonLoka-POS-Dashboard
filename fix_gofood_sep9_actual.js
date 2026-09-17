import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const targetDate = '2026-09-09'
  
  const { data: subs } = await supabase.from('staff_submissions')
    .select('*')
    .eq('type', 'daily_recon')
    .eq('data->>date', targetDate)
    
  if (subs && subs.length > 0) {
    let sub = subs[0]
    let modified = false
    
    sub.data.items = sub.data.items.map(it => {
      if (it.name === 'Sate Kambing (sub)') {
        it.actual_qty = 282
        it.diff_qty = 0
        it.diff_value = 0
        modified = true
      }
      return it
    })
    
    if (modified) {
      await supabase.from('staff_submissions').update({ data: sub.data }).eq('id', sub.id)
      console.log("Updated Sept 9th Sate Kambing to actual_qty: 282")
      
      // We also need to update the live ingredients table to 282 so the 10th starts from 282
      await supabase.from('ingredients').update({ stock: 282 }).eq('name', 'Sate Kambing (sub)')
      console.log("Updated live stock to 282")
    }
  }
}
run()
