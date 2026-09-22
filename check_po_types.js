import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Check all Purchase movements recently
  const { data: allPurch } = await supabase.from('stock_movements').select('*').eq('type', 'Purchase').gte('date', '2026-09-18').order('date')
  console.log("=== ALL PURCHASE MOVEMENTS Sept 18+ ===")
  allPurch.forEach(m => console.log(`  date=${m.date} | ${m.ingredient_name} | qty=${m.qty} | ref=${m.ref} | created=${m.created_at}`))

  // Check how POs are stored - look for any table/type related to PO
  const { data: poMoves } = await supabase.from('stock_movements').select('*').like('ref', 'PO-%').gte('date', '2026-09-18').order('date')
  console.log("\n=== PO-REFERENCED MOVEMENTS Sept 18+ ===")
  poMoves.forEach(m => console.log(`  date=${m.date} | ${m.ingredient_name} | qty=${m.qty} | ref=${m.ref} | created=${m.created_at}`))

  // Now check the critical issue: the `loadData` function uses `today` which is
  // calculated with the before-6am logic. But `stock_movements.date` is set differently
  // by each feature. Let me check exactly how PO receive sets the date.
  
  // Check how the production submission code determines the `date` field
  // The production SS-1789813865468 has data.date = "2026-09-18" but was submitted on Sept 19
  // This means the production form has a date picker that the staff can set
  // But the stock_movements.date was also set to 2026-09-18
  // So the movements ARE correctly dated
  
  // The REAL issue: the recon was submitted BEFORE the production was logged
  // Timeline for Sept 18:
  //   Recon submitted: Sept 18 16:08 UTC (Sept 19 00:08 local)
  //   Production logged: Sept 19 10:31 UTC (Sept 19 18:31 local)
  //   Production backdated to Sept 18
  //   But recon already captured the data 18 hours earlier!
  
  console.log("\n=== TIMELINE ANALYSIS ===")
  console.log("Sept 18:")
  console.log("  Recon: 2026-09-18T16:08 UTC = Sept 19 00:08 local (SUBMITTED FIRST)")
  console.log("  Prod (Telor -4): 2026-09-19T10:31 UTC = Sept 19 18:31 local (SUBMITTED 18 HRS LATER, backdated to Sept 18)")
  console.log("  Result: Recon missed the Telor -4 production because it didn't exist yet!")
  
  console.log("\nSept 19:")
  console.log("  Production Oji (Ayam BK +15): 2026-09-19T15:56 UTC = Sept 19 23:56 local (BEFORE midnight)")
  console.log("  Recon: 2026-09-19T16:50 UTC = Sept 20 00:50 local (AFTER midnight)")
  console.log("  Mahes prod: 2026-09-19T17:05 UTC = Sept 20 01:05 local (AFTER recon!)")
  console.log("  Result: Oji's +15 Ayam BK SHOULD have been picked up. Let me verify...")
  
  // Verify Sept 19 recon data
  const { data: r19 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789836652950').single()
  const ayam19 = r19.data.items.find(i => i.name === 'Ayam Bumbu Kuning (sub)')
  console.log("\nSept 19 Recon Ayam BK:", ayam19)
}
run()
