import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon')
  const sep5 = subs.find(s => s.data && s.data.date === '2026-09-05')
  if (sep5) {
    sep5.data.items = sep5.data.items.map(it => {
      if (it.ingredient_id === 'ING-154') {
        // Sate Kambing. Original actual was 328. Currently actual is 325. Expected is 325.
        it.actual_qty = 328;
        it.diff_qty = 3;
      }
      if (it.ingredient_id === 'ING-183') {
        // Telor. Original actual was 84. Currently actual is 81. Expected is 81.
        it.actual_qty = 84;
        it.diff_qty = 3;
      }
      return it;
    })
    await supabase.from('staff_submissions').update({ data: sep5.data }).eq('id', sep5.id)
    
    // Also revert the live stock deduction and the Waste movements I created!
    const { data: sk } = await supabase.from('ingredients').select('stock').eq('id', 'ING-154').single()
    await supabase.from('ingredients').update({ stock: sk.stock + 3 }).eq('id', 'ING-154')
    
    const { data: tl } = await supabase.from('ingredients').select('stock').eq('id', 'ING-183').single()
    await supabase.from('ingredients').update({ stock: tl.stock + 3 }).eq('id', 'ING-183')
    
    await supabase.from('stock_movements').delete().eq('note', 'Fix overcount from Sep 5 Void bug')
  }
  console.log("Reverted Sep 5 actual_qty for Kambing & Telor to original values")
}
run()
