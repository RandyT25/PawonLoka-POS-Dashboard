import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: exist } = await supabase.from('stock_movements').select('*').eq('ingredient_id', 'ING-201').eq('ref', 'SS-1788630730419-extra')
  if (exist && exist.length > 0) {
    console.log("Already deducted 1.5kg of Tulangan for Sept 5th!")
    return
  }
  
  const { data: ing } = await supabase.from('ingredients').select('*').eq('id', 'ING-201').single()
  
  const mov = {
    id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
    ingredient_id: 'ING-201',
    ingredient_name: 'Tulang Kambing',
    type: 'Production',
    qty: -1500,
    unit: 'gr',
    date: '2026-09-05',
    time: '17.52',
    ref: 'SS-1788630730419-extra', // Fake ref based on the production submission
    note: 'Auto-backfill extra tulangan 1.5kg from Sept 5th notes'
  }
  
  await supabase.from('stock_movements').insert([mov])
  await supabase.from('ingredients').update({ stock: ing.stock - 1500 }).eq('id', 'ING-201')
  console.log("Successfully deducted 1.5kg of Tulang Kambing for Sept 5th!")
}
run()
