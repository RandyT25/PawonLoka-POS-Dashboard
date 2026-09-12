import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon')
  const sep5 = subs.find(s => s.data && s.data.date === '2026-09-05')
  
  if (!sep5) { console.log("Sep 5 submission not found!"); return }
  
  let sateKambingFix = false;
  let telorFix = false;
  let sateAyamFix = false;

  sep5.data.items = sep5.data.items.map(it => {
    if (it.ingredient_id === 'ING-154') {
      if (it.added_qty === 3) {
        it.added_qty = 0;
        it.expected_qty -= 3;
        it.actual_qty -= 3;
        sateKambingFix = true;
      }
    }
    if (it.ingredient_id === 'ING-183') {
      if (it.added_qty === 3) {
        it.added_qty = 0;
        it.expected_qty -= 3;
        it.actual_qty -= 3;
        telorFix = true;
      }
    }
    if (it.ingredient_id === 'ING-155') {
      if (!it.fixed_extra) { // prevent double fix
        it.expected_qty -= 12;
        it.actual_qty -= 12;
        it.waste_qty = (it.waste_qty || 0) + 12;
        it.fixed_extra = true;
        sateAyamFix = true;
      }
    }
    return it;
  })

  // Update submission
  await supabase.from('staff_submissions').update({ data: sep5.data }).eq('id', sep5.id)
  
  // Deduct from live stock
  if (sateKambingFix) {
    const { data: sk } = await supabase.from('ingredients').select('stock').eq('id', 'ING-154').single()
    await supabase.from('ingredients').update({ stock: sk.stock - 3 }).eq('id', 'ING-154')
  }
  if (telorFix) {
    const { data: tl } = await supabase.from('ingredients').select('stock').eq('id', 'ING-183').single()
    await supabase.from('ingredients').update({ stock: tl.stock - 3 }).eq('id', 'ING-183')
  }
  if (sateAyamFix) {
    const { data: sa } = await supabase.from('ingredients').select('stock').eq('id', 'ING-155').single()
    await supabase.from('ingredients').update({ stock: sa.stock - 12 }).eq('id', 'ING-155')
  }
  
  // Add stock movements to explain the live stock deduction!
  if (sateKambingFix || telorFix || sateAyamFix) {
    const writes = [];
    const dateStr = new Date().toISOString().slice(0,10)
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })
    if (sateKambingFix) {
      writes.push({ id: `MOV-FIX-154-${Date.now()}`, ingredient_id: 'ING-154', ingredient_name: 'Sate Kambing (sub)', type: 'Waste', qty: -3, unit: 'pcs', note: 'Fix overcount from Sep 5 Void bug', date: dateStr, time: timeStr, actor: 'System' })
    }
    if (telorFix) {
      writes.push({ id: `MOV-FIX-183-${Date.now()}`, ingredient_id: 'ING-183', ingredient_name: 'Telor', type: 'Waste', qty: -3, unit: 'pcs', note: 'Fix overcount from Sep 5 Void bug', date: dateStr, time: timeStr, actor: 'System' })
    }
    if (sateAyamFix) {
      writes.push({ id: `MOV-FIX-155-${Date.now()}`, ingredient_id: 'ING-155', ingredient_name: 'Sate Ayam (sub)', type: 'Waste', qty: -12, unit: 'pcs', note: 'Fix 12 extra pcs used for Mie/Bihun on Sep 5', date: dateStr, time: timeStr, actor: 'System' })
    }
    await supabase.from('stock_movements').insert(writes)
  }

  console.log("Fixes applied:", { sateKambingFix, telorFix, sateAyamFix })
}
run()
