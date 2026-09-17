import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const d = '2026-09-06'
  const prevD = '2026-09-05'
  const { data: prevSubs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', `${prevD}%`)
  let pItems = prevSubs[0].data.items
  let pTul = pItems.find(it => it.ingredient_id === 'ING-201')
  console.log("From DB Sept 5 actual_qty:", pTul.actual_qty)
  
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', `${d}%`)
  let recon = subs[0]
  let tulang = recon.data.items.find(it => it.ingredient_id === 'ING-201')
  console.log("Before update Sept 6 opening_stock:", tulang.opening_stock)
  
  tulang.opening_stock = pTul.actual_qty
  tulang.expected_qty = tulang.opening_stock + tulang.added_qty - tulang.production_qty
  tulang.actual_qty = tulang.expected_qty
  console.log("After update Sept 6 opening_stock:", tulang.opening_stock)
  console.log("After update Sept 6 expected_qty:", tulang.expected_qty)
  
  // Let's force update it
  await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', recon.id)
  console.log("Force updated!")
}
run()
