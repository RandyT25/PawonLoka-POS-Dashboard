import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Check ALL Telor purchases ever
  const { data: allTelorPO } = await supabase.from('stock_movements').select('*').eq('type', 'Purchase').eq('ingredient_id', 'ING-183')
  console.log("=== ALL TELOR PURCHASES EVER ===")
  allTelorPO.forEach(m => console.log(`  date=${m.date} | created=${m.created_at} | qty=${m.qty} | ref=${m.ref}`))
  
  // Check the Sept 18 production Telor -4: it was created on Sept 19 at 18:31 local
  // But assigned date=2026-09-18. The recon for Sept 18 was submitted at 00:08 local Sept 19
  // So production was created AFTER the recon was submitted!
  // Timeline:
  //   Sept 18 recon submitted: 2026-09-18T16:08 UTC = Sept 19 00:08 local
  //   Sept 18 production (Telor -4): 2026-09-19T10:31 UTC = Sept 19 18:31 local
  //   This production was inputted the NEXT AFTERNOON but backdated to Sept 18!

  // Check how production sets the date
  console.log("\n\n=== CHECKING HOW PRODUCTION SETS DATE ===")
  // The production submission SS-1789813865468 was submitted_at 2026-09-19T10:31:16 UTC
  // But it created movements with date=2026-09-18
  // This means the production form must have a date picker or it uses a different date logic
  
  const { data: prodSub } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-1789813865468').single()
  console.log("Production submission data:", JSON.stringify(prodSub.data?.date || prodSub.data, null, 2).slice(0, 500))
  
  // Check Sept 22 recon - Telor went from 49 to 149 (+100)
  // There are NO Telor purchases anywhere. So where did 100 eggs come from?
  // Let me check if there's a PO that has Telor but wasn't recorded as stock_movement
  const { data: allPOs } = await supabase.from('staff_submissions').select('id, submitted_at, data').eq('type', 'purchase_order').gte('submitted_at', '2026-09-20T00:00:00Z').order('submitted_at', { ascending: true })
  console.log("\n=== RECENT PURCHASE ORDERS ===")
  ;(allPOs || []).forEach(po => {
    const items = po.data?.items || po.data?.received_items || []
    const hasEgg = items.some(i => i.ingredient_name === 'Telor' || i.name === 'Telor' || i.ingredient_id === 'ING-183')
    if (hasEgg) {
      console.log(`  PO ${po.id} at ${po.submitted_at}:`, items.filter(i => i.ingredient_name === 'Telor' || i.name === 'Telor' || i.ingredient_id === 'ING-183'))
    }
  })
  
  // Also check purchase_receive type
  const { data: allRecv } = await supabase.from('staff_submissions').select('id, submitted_at, type, data').in('type', ['purchase_order', 'po_receive', 'purchase']).gte('submitted_at', '2026-09-20T00:00:00Z').order('submitted_at', { ascending: true })
  console.log("\n=== ALL PO/RECEIVE SUBMISSIONS ===")
  ;(allRecv || []).forEach(r => {
    console.log(`  ${r.type} ${r.id} at ${r.submitted_at}`)
  })
}
run()
