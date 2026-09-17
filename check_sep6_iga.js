import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: movs } = await supabase.from('stock_movements').select('*').in('ingredient_id', ['ING-170', 'ING-200', 'ING-201']).eq('date', '2026-09-06')
  
  console.log("Sept 6 Movements:")
  movs.forEach(m => console.log(`[${m.ingredient_name}] ${m.type} ${m.qty} (Ref: ${m.ref})`))
  
  // Also check the JSON for the Sept 6th Recon
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', '2026-09-06%')
  if(subs.length > 0) {
    const recon = subs[0]
    const items = recon.data.items
    const sop = items.find(i => i.ingredient_id === 'ING-170')
    const iga = items.find(i => i.ingredient_id === 'ING-200')
    console.log("\nRecon JSON:")
    console.log(`Sop Iga: added_qty=${sop.added_qty}, production_qty=${sop.production_qty}, adj_qty=${sop.adj_qty}`)
    console.log(`Tulang Iga: added_qty=${iga.added_qty}, production_qty=${iga.production_qty}, adj_qty=${iga.adj_qty}`)
  }
}
run()
