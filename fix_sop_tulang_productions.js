import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const movs = []
  
  // SEPT 3
  movs.push({
    id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
    ingredient_id: 'ING-1781533071195',
    ingredient_name: 'Sop Tulang Kambing (sub)',
    type: 'Yield',
    qty: 20,
    unit: 'portion',
    date: '2026-09-03',
    time: '23.59',
    ref: 'SS-MANUAL-SEP3',
    note: 'Auto-backfill missing production by Meldy (1 batch)'
  })
  movs.push({
    id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
    ingredient_id: 'ING-201',
    ingredient_name: 'Tulang Kambing',
    type: 'Production',
    qty: -3000,
    unit: 'gr',
    date: '2026-09-03',
    time: '23.59',
    ref: 'SS-MANUAL-SEP3',
    note: 'Auto-backfill missing production by Meldy (1 batch)'
  })

  // SEPT 5
  movs.push({
    id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
    ingredient_id: 'ING-1781533071195',
    ingredient_name: 'Sop Tulang Kambing (sub)',
    type: 'Yield',
    qty: 10,
    unit: 'portion',
    date: '2026-09-05',
    time: '23.59',
    ref: 'SS-1788630730419-extra', // using the same ref as the -1500g bone deduction
    note: 'Auto-backfill missing 0.5 batch yield by Meldy'
  })

  // SEPT 7
  movs.push({
    id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
    ingredient_id: 'ING-1781533071195',
    ingredient_name: 'Sop Tulang Kambing (sub)',
    type: 'Yield',
    qty: 20,
    unit: 'portion',
    date: '2026-09-07',
    time: '23.59',
    ref: 'SS-MANUAL-SEP7',
    note: 'Auto-backfill missing production by Meldy (used 2kg bones)'
  })
  movs.push({
    id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
    ingredient_id: 'ING-201',
    ingredient_name: 'Tulang Kambing',
    type: 'Production',
    qty: -2000,
    unit: 'gr',
    date: '2026-09-07',
    time: '23.59',
    ref: 'SS-MANUAL-SEP7',
    note: 'Auto-backfill missing production by Meldy (used 2kg bones)'
  })

  await supabase.from('stock_movements').insert(movs)
  
  // Update Live Stock
  const { data: ings } = await supabase.from('ingredients').select('id, stock').in('id', ['ING-1781533071195', 'ING-201'])
  let sopTul = ings.find(i => i.id === 'ING-1781533071195')
  let tulang = ings.find(i => i.id === 'ING-201')
  
  await supabase.from('ingredients').update({ stock: sopTul.stock + 50 }).eq('id', 'ING-1781533071195')
  await supabase.from('ingredients').update({ stock: tulang.stock - 5000 }).eq('id', 'ING-201')
  
  console.log("Successfully inserted missing productions for Sept 3, 5, 7!")
}
run()
