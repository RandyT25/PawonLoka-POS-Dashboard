import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: movs } = await supabase.from('stock_movements').select('*').in('ingredient_name', ['Ayam Bumbu Kuning (sub)', 'Sop Iga Kambing (sub)', 'Sate Kambing (sub)', 'Ayam Taliwang (sub)', 'Telor']).gte('date', '2026-09-06')
  console.log("Movements since Sep 6:")
  movs.forEach(m => console.log(`${m.date} ${m.time} | ${m.ingredient_name} | ${m.type} | ${m.qty} | ${m.note}`))
}
run()
