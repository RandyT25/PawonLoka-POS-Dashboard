import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-12').ilike('time', '00.06%')
  console.log("Movements at 00.06 on Sept 12:")
  data.forEach(d => console.log(d.id, d.ingredient_name, d.type, d.qty, d.note))
}
run()
