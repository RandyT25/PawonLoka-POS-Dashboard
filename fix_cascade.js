import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions')
    .select('*')
    .eq('type', 'daily_recon')
    .gte('data->>date', '2026-09-05')
    .order('data->>date', { ascending: true })

  for (const sub of subs) {
    const d = sub.data;
    let modified = false;

    d.items = d.items.map(it => {
      if (it.ingredient_id === 'ING-154') {
        if (d.date === '2026-09-05') {
          if (it.added_qty === 3) {
            it.added_qty = 0;
            it.expected_qty -= 3;
            it.actual_qty -= 3;
            modified = true;
          }
        } else {
          it.opening_stock -= 3;
          it.expected_qty -= 3;
          it.actual_qty -= 3;
          modified = true;
        }
      }
      
      if (it.ingredient_id === 'ING-183') {
        if (d.date === '2026-09-05') {
          if (it.added_qty === 3) {
            it.added_qty = 0;
            it.expected_qty -= 3;
            it.actual_qty -= 3;
            modified = true;
          }
        } else {
          it.opening_stock -= 3;
          it.expected_qty -= 3;
          it.actual_qty -= 3;
          modified = true;
        }
      }
      return it;
    })

    if (modified) {
      await supabase.from('staff_submissions').update({ data: d }).eq('id', sub.id)
      console.log(`Updated submission for ${d.date}`)
    }
  }

  // Deduct 3 from live stock
  const { data: sk } = await supabase.from('ingredients').select('stock').eq('id', 'ING-154').single()
  await supabase.from('ingredients').update({ stock: sk.stock - 3 }).eq('id', 'ING-154')
  
  const { data: tl } = await supabase.from('ingredients').select('stock').eq('id', 'ING-183').single()
  await supabase.from('ingredients').update({ stock: tl.stock - 3 }).eq('id', 'ING-183')

  // Add fixing movements
  const dateStr = new Date().toISOString().slice(0,10)
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })
  await supabase.from('stock_movements').insert([
    { id: `MOV-FIX-154-${Date.now()}`, ingredient_id: 'ING-154', ingredient_name: 'Sate Kambing (sub)', type: 'Waste', qty: -3, unit: 'pcs', note: 'Fix overcount from Sep 5 Void bug (cascade)', date: dateStr, time: timeStr, actor: 'System' },
    { id: `MOV-FIX-183-${Date.now()}`, ingredient_id: 'ING-183', ingredient_name: 'Telor', type: 'Waste', qty: -3, unit: 'pcs', note: 'Fix overcount from Sep 5 Void bug (cascade)', date: dateStr, time: timeStr, actor: 'System' }
  ])

  console.log("Cascade fix completed.")
}
run()
