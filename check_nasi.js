import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('id, type, qty, ingredient_name, date, time, note')
    .eq('type', 'Production')
    .eq('date', '2026-09-16')
    .order('time')
  
  if (error) {
    console.error(error)
    return
  }
  
  data.forEach(d => {
    console.log(`[${d.time}] ${d.qty} ${d.ingredient_name}`)
  })
}

run()
