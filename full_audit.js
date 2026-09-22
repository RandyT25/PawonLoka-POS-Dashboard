import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const dates = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22']
  
  for (const date of dates) {
    // Get the recon(s) for this date
    const { data: recons } = await supabase.from('staff_submissions').select('*')
      .eq('type', 'daily_recon')
      .order('submitted_at', { ascending: false })
      .limit(30)
    
    const dayRecons = recons.filter(r => r.data?.date === date)
    if (dayRecons.length === 0) continue
    
    // Get ALL movements for this date
    const { data: moves } = await supabase.from('stock_movements').select('*').eq('date', date)
    
    // Get movements that were CREATED AFTER the recon was submitted but have this date
    const reconSubmittedAt = dayRecons[0].submitted_at
    const lateMovements = moves.filter(m => m.created_at > reconSubmittedAt)
    
    if (lateMovements.length > 0) {
      console.log(`\n=== ${date} ===`)
      console.log(`  Recon submitted at: ${reconSubmittedAt}`)
      console.log(`  Late movements (created AFTER recon but dated ${date}):`)
      lateMovements.forEach(m => {
        console.log(`    ${m.type} | ${m.ingredient_name} | qty=${m.qty} | created=${m.created_at} | ref=${m.ref}`)
      })
    }
  }
}
run()
