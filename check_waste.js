import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: moves } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-15').eq('type', 'Waste')
  console.log(`Found ${moves?.length || 0} waste records on Sept 15th`)
  if (moves && moves.length > 0) {
      console.log(moves)
  }
}
run()
