import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('id, ingredient_name, qty, date, type, note')
    .eq('type', 'Production')
    .gte('date', '2026-09-12')
    .order('date', { ascending: false })
  
  if (error) {
    console.error(error)
    return
  }
  
  console.log("Recent Production Movements:")
  data.forEach(d => {
    console.log(`[${d.date}] ${d.qty > 0 ? '+' : ''}${d.qty} ${d.ingredient_name} | Note: ${d.note}`)
  })
}

run()
