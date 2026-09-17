import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: movs } = await supabase.from('stock_movements').select('*').eq('ingredient_name', 'Tulang Iga Kambing')
  
  console.log("Tulang Iga Kambing Movements:")
  movs.forEach(m => console.log(`[${m.date}] ${m.type} ${m.qty} (ID: ${m.id}) (Created: ${m.created_at})`))
}
run()
