import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('id, type, qty, note, date, time')
    .eq('ingredient_name', 'Telor')
    .gte('date', '2026-09-12')
  
  if (error) {
    console.error(error)
    return
  }
  
  console.log("Telor Movements:")
  console.log(data)
}

run()
