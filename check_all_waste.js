import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: moves } = await supabase.from('stock_movements').select('*').eq('type', 'Waste').order('date', { ascending: false }).limit(10)
  console.log(`Recent Waste Records:`)
  if (moves && moves.length > 0) {
      moves.forEach(m => console.log(`${m.date} ${m.time} | ${m.qty} ${m.ingredient_name} | ${m.note} | actor: ${m.actor}`))
  } else {
      console.log("None found.")
  }
}
run()
