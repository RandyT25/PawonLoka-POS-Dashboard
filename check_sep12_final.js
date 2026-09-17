import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', '2026-09-12%')
  let recon = subs[0]
  let items = recon.data.items
  
  const iga = items.find(it => it.ingredient_id === 'ING-200')
  console.log("Tulang Iga Kambing Final (12th):")
  console.log(iga)
  
  const tulang = items.find(it => it.ingredient_id === 'ING-201')
  console.log("\nTulang Kambing Final (12th):")
  console.log(tulang)
}
run()
