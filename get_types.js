import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('type')
    .gte('date', '2026-09-12')
  
  if (error) {
    console.error(error)
    return
  }
  
  const types = [...new Set(data.map(d => d.type))]
  console.log("Types:", types)
}

run()
