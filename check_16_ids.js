import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: moves16 } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-16').eq('ref', 'PROD-AUTO')
  console.log("PROD AUTO MOVES:", moves16)
  
  const { data: r16 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789575677326').single()
  const sate = r16.data.items.find(i => i.name === 'Sate Kambing (sub)')
  console.log("SATE FROM 16 REPORT:", sate.ingredient_id)
}
run()
