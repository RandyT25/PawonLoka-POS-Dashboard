import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { error } = await supabase.from('stock_movements').delete().eq('id', 'MOV-FIX-154-1789046054177')
  console.log("Deleted bug fix movement for Sate Kambing:", error || 'success')
  
  // also check if there are any other 'Fix overcount from Sep 5 Void bug (cascade)' on Sept 10
  const { data } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-10').ilike('note', '%Fix overcount%')
  console.log("Other bug fixes on Sept 10:", data.length)
  if(data.length > 0) {
    for(const d of data) {
       await supabase.from('stock_movements').delete().eq('id', d.id)
       console.log("Deleted", d.ingredient_name, d.qty)
    }
  }
}
run()
