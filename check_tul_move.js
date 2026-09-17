import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: m } = await supabase.from('stock_movements').select('*').eq('ingredient_name', 'Tulang Iga Kambing').eq('date', '2026-09-12')
  console.log(m)
}
run()
