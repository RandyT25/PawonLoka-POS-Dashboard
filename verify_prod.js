import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('id, type, qty, ingredient_name, date, time')
    .eq('type', 'Production')
    .order('created_at', { ascending: false })
    .limit(30)
  
  if (error) {
    console.error(error)
    return
  }
  
  console.log("Recent Production logs:")
  data.forEach(d => {
    console.log(`[${d.date} ${d.time}] ${d.ingredient_name} : ${d.qty}`)
  })
}

run()
