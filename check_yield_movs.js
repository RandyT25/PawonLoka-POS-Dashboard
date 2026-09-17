import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: movs } = await supabase.from('stock_movements').select('*').eq('type', 'Production').eq('date', '2026-09-12').gt('qty', 0)
  
  console.log("POSITIVE YIELD MOVEMENTS on 12th:")
  movs.forEach(m => console.log(`${m.ingredient_name}: +${m.qty} (Created: ${m.created_at})`))
}
run()
