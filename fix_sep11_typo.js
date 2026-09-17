import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  // 1. Fix the Daily Recon
  const { data } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-11')
  
  if (data && data.length > 0) {
    let recon = data[0]
    let items = recon.data.items
    
    // Fix Sate Kambing
    let sate = items.find(i => i.name === 'Sate Kambing (sub)')
    if (sate) {
      sate.actual_qty = 248
      sate.diff_qty = sate.actual_qty - sate.expected_qty
      sate.diff_value = sate.diff_qty * sate.cost_per_unit
    }
    
    recon.data.total_variance_value = items.reduce((sum, i) => sum + i.diff_value, 0)
    
    await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', recon.id)
    console.log("Updated Recon Sate Kambing to 248!")
    
    // Fix live stock for Sate Kambing
    await supabase.from('ingredients').update({ stock: 248 }).eq('name', 'Sate Kambing (sub)')
    console.log("Updated Sate Kambing Live Stock to 248!")
  }

  // 2. Insert missing production for Taliwang
  // We'll use the ID of the submission from 00:06:44 -> SS-1789142793658
  const { data: taliwang } = await supabase.from('ingredients').select('*').eq('name', 'Ayam Taliwang (sub)')
  if (taliwang && taliwang.length > 0) {
    const pId = 'MOV-FIX-' + Date.now()
    const { error: err2 } = await supabase.from('stock_movements').insert([
      { 
        id: pId,
        ingredient_id: taliwang[0].id, 
        ingredient_name: 'Ayam Taliwang (sub)',
        type: 'Production', 
        qty: 10, 
        unit: 'pcs',
        date: '2026-09-11', 
        time: '23.06', // The time of submission was 00.06 local, we can just use 23.06 to be consistent with others
        ref: 'SS-1789142793658',
        note: 'Orphan backfill: Auto-approved production output by Oji (Manual Fix)'
      }
    ])
    if (err2) {
      console.log("Error inserting production:", err2)
    } else {
      console.log("Inserted missing Ayam Taliwang +10 production movement!")
    }
  }
}
run()
