import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: moves } = await supabase.from('stock_movements').select('*').eq('type', 'Waste').like('ingredient_name', '%Bumbu Kuning%')
  console.log(moves.map(m => ({ id: m.id, date: m.date, qty: m.qty, note: m.note })))
}
run()
