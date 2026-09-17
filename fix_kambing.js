import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  await supabase.from('stock_movements').delete().eq('ingredient_id', 'ING-046').eq('qty', 1).eq('type', 'Adjustment')
  
  const { data: sk } = await supabase.from('ingredients').select('stock').eq('id', 'ING-046').single()
  await supabase.from('ingredients').update({ stock: sk.stock - 1 }).eq('id', 'ING-046')
  
  // also check staff_submissions just in case to fix it
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-04')
  for (const sub of subs) {
    if (sub.data.items) {
      let mod = false;
      sub.data.items = sub.data.items.map(it => {
        if (it.ingredient_id === 'ING-046') {
          if (it.actual_qty === 4001) {
            it.actual_qty = 4000;
            it.diff_qty = 0;
            mod = true;
          }
        }
        return it;
      })
      if (mod) {
        await supabase.from('staff_submissions').update({ data: sub.data }).eq('id', sub.id)
      }
    }
  }

  console.log("Fixed 1gr issue")
}
run()
