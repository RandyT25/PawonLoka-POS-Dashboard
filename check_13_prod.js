import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  // Check stock movements on the 13th
  const { data: movs } = await supabase.from('stock_movements').select('*').in('type', ['Production']).in('date', ['2026-09-13', '2026-09-12'])
  
  console.log("PRODUCTION MOVEMENTS (12th & 13th):")
  movs.forEach(m => {
    console.log(`[${m.date}] ${m.ingredient_name}: ${m.qty} (ID: ${m.id}) (Created: ${m.created_at})`)
  })

  // Check staff submissions for production on the 13th
  const { data: subs } = await supabase.from('staff_submissions').select('*').in('type', ['production', 'daily_recon']).gte('submitted_at', '2026-09-12T16:00:00Z')
  
  console.log("\nRECENT SUBMISSIONS (Production/Recon):")
  subs.forEach(s => {
    console.log(`[${s.type}] ${s.submitted_at} - Date: ${s.data?.date} - Staff: ${s.data?.staff_name || s.staff_id}`)
    if (s.type === 'production') {
      console.log(`   Output: ${s.data?.actual_yield} ${s.data?.output_item?.name}`)
    }
  })
}
run()
