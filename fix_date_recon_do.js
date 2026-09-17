import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const reconId = 'SS-RECON-1789285791613'
  
  // 1. Get and update recon
  const { data: recons } = await supabase.from('staff_submissions').select('*').eq('id', reconId)
  if (recons.length > 0) {
    let recon = recons[0]
    recon.data.date = '2026-09-12' // change date to 12th
    
    const { error } = await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', reconId)
    if (error) {
      console.log("Error updating recon:", error)
    } else {
      console.log("Successfully updated recon date to 2026-09-12!")
    }
  }

  // 2. Find associated movements and update their date
  // Usually movements for recon don't have a direct ref to the recon ID except maybe in notes or ref?
  // Let's check movements from that exact time.
  const { data: movs } = await supabase.from('stock_movements').select('*').in('type', ['Waste', 'Adjustment']).gte('created_at', '2026-09-13T07:49:50Z').lte('created_at', '2026-09-13T07:50:10Z')
  
  console.log("Found movements around the submission time:", movs.length)
  for (const m of movs) {
    const { error: mErr } = await supabase.from('stock_movements').update({ date: '2026-09-12' }).eq('id', m.id)
    console.log(`Updated movement ${m.id} (${m.ingredient_name}) to 2026-09-12:`, mErr || "success")
  }
}
run()
