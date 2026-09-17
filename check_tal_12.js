import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data } = await supabase.from('stock_movements').select('*').eq('ingredient_name', 'Ayam Taliwang (sub)').eq('type', 'Production')
  console.log("Ayam Taliwang Production:")
  data.forEach(d => console.log(d.id, d.date, d.time, d.qty, d.note))
}
run()
