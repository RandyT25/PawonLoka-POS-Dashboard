import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: movs } = await supabase.from('stock_movements').select('*').eq('ingredient_id', 'ING-046').order('created_at', { ascending: false }).limit(20)
  console.log("Latest movements for Daging Kambing:")
  movs.forEach(m => console.log(`${m.date} ${m.time} | ${m.type} | qty: ${m.qty} | note: ${m.note}`))
}
run()
