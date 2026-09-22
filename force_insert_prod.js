import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const prodDate = '2026-09-16'
  const moves = [
    { type: 'Production', ingredient_id: 'ING-046', ingredient_name: 'Daging Kambing', qty: -4000, unit: 'gr', ref: 'PROD-AUTO', note: 'Auto-fill forgotten production', date: prodDate, time: '12.00', actor: 'System' },
    { type: 'Production', ingredient_id: 'ING-201', ingredient_name: 'Tulang Kambing', qty: -2000, unit: 'gr', ref: 'PROD-AUTO', note: 'Auto-fill forgotten production', date: prodDate, time: '12.00', actor: 'System' },
    { type: 'Production', ingredient_id: 'ING-154', ingredient_name: 'Sate Kambing (sub)', qty: 228, unit: 'pcs', ref: 'PROD-AUTO', note: 'Auto-fill forgotten production', date: prodDate, time: '12.00', actor: 'System' }
  ]
  const { error } = await supabase.from('stock_movements').insert(moves)
  if (error) console.error("Insert error:", error)
  else console.log("Insert success")
}
run()
