import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon')
  
  for (const sub of subs) {
    if (!sub.data.items) continue
    
    let mod = false
    sub.data.items = sub.data.items.map(it => {
      if (it.ingredient_id === 'ING-046' || it.name === 'Daging Kambing') {
        if (it.opening_stock === 10001) { it.opening_stock = 10000; mod = true; }
        if (it.expected_qty === 10001) { it.expected_qty = 10000; mod = true; }
        if (it.actual_qty === 10001) { it.actual_qty = 10000; mod = true; }
        if (it.opening_stock === 4001) { it.opening_stock = 4000; mod = true; }
        if (it.expected_qty === 4001) { it.expected_qty = 4000; mod = true; }
        if (it.actual_qty === 4001) { it.actual_qty = 4000; mod = true; }
        
        // Fix the diff_qty just in case
        it.diff_qty = it.actual_qty - it.expected_qty;
      }
      return it
    })
    
    if (mod) {
      await supabase.from('staff_submissions').update({ data: sub.data }).eq('id', sub.id)
      console.log(`Fixed 1gr in ${sub.data.date}`)
    }
  }
  
  // Fix live stock
  const { data: sk } = await supabase.from('ingredients').select('stock').eq('id', 'ING-046').single()
  if (sk.stock === 10001) {
    await supabase.from('ingredients').update({ stock: 10000 }).eq('id', 'ING-046')
    console.log("Fixed live stock to 10000")
  }
}
run()
