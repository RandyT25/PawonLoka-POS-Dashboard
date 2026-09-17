import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { error } = await supabase
    .from('stock_movements')
    .update({ type: 'Adjustment' })
    .eq('date', '2026-09-08')
    .ilike('notes', '%Staff meal%')
    
  if (error) console.error(error)
  else console.log("Changed Staff Meal from Waste to Adjustment")
}
run()
