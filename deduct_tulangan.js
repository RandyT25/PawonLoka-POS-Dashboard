import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: exist } = await supabase.from('stock_movements').select('*').eq('ingredient_id', 'ING-201').eq('ref', 'SS-1789229660653-extra')
  if (exist && exist.length > 0) {
    console.log("Already deducted 2kg of Tulangan!")
    return
  }
  
  const { data: ing } = await supabase.from('ingredients').select('*').eq('id', 'ING-201').single()
  
  const mov = {
    id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
    ingredient_id: 'ING-201',
    ingredient_name: 'Tulang Kambing',
    type: 'Production',
    qty: -2000,
    unit: 'gr',
    date: '2026-09-12',
    time: '23.14',
    ref: 'SS-1789229660653-extra',
    note: 'Auto-backfill extra tulangan 2kg from Meldy notes'
  }
  
  await supabase.from('stock_movements').insert([mov])
  await supabase.from('ingredients').update({ stock: ing.stock - 2000 }).eq('id', 'ING-201')
  
  // Re-run Recon math script for the updated Expected Sisa
}
run()
