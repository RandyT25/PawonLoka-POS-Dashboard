import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // The key issue: production/waste submitted AFTER recon but with SAME date
  // Because the `date` field on stock_movements uses the same `today` logic
  
  // SEPT 18 RECON: submitted at 16:08 UTC = 00:08 local (Sept 19)
  // But date = 2026-09-18
  // Production by Alin at 10:31-10:39 UTC Sept 19 = 18:31 local Sept 19
  // These have date=2026-09-18 in stock_movements!
  
  // Let's check what date the production movements got assigned
  const refs18 = ['SS-1789813865468'] // Alin's production that has Telor -4
  for (const ref of refs18) {
    const { data: moves } = await supabase.from('stock_movements').select('*').eq('ref', ref)
    const telor = moves.find(m => m.ingredient_name === 'Telor')
    if (telor) {
      console.log(`\nProd ref ${ref}:`)
      console.log(`  date=${telor.date} | created_at=${telor.created_at} | Telor qty=${telor.qty}`)
    }
  }
  
  // SEPT 19 RECON: submitted at 16:50 UTC = 00:50 local (Sept 20)
  // Production by Oji (SS-1789833361940) at 15:56 UTC Sept 19 = 23:56 local Sept 19
  // That's BEFORE midnight, so should be on Sept 19
  // But production by Mahes at 17:05-17:07 UTC Sept 19 = 01:05 local Sept 20
  // These would be after midnight!
  
  console.log("\n=== SEPT 19 PRODUCTION TIMELINE ===")
  const prodRefs19 = ['SS-1789833361940', 'SS-1789837530267', 'SS-1789837587244', 'SS-1789837607380', 'SS-1789837636795']
  for (const ref of prodRefs19) {
    const { data: moves } = await supabase.from('stock_movements').select('date, created_at, ingredient_name, qty').eq('ref', ref).limit(3)
    if (moves && moves.length > 0) {
      console.log(`  ref=${ref} | date=${moves[0].date} | created=${moves[0].created_at} | items: ${moves.map(m => `${m.ingredient_name}(${m.qty})`).join(', ')}`)
    }
  }
  
  // SEPT 19 WASTE: Mahes at 17:10 UTC = 01:10 local Sept 20
  console.log("\n=== SEPT 19 WASTE (Mahes at 01:10 local Sept 20) ===")
  const { data: waste19 } = await supabase.from('stock_movements').select('*').eq('type', 'Waste').eq('date', '2026-09-19')
  waste19.forEach(m => console.log(`  date=${m.date} | created=${m.created_at} | ${m.ingredient_name} qty=${m.qty}`))
  
  // SEPT 22 - check for PO with Telor
  console.log("\n=== SEPT 22 PURCHASES ===")
  const { data: po22 } = await supabase.from('stock_movements').select('*').eq('type', 'Purchase').eq('date', '2026-09-22')
  const tracked = po22.filter(m => m.ingredient_name === 'Telor' || m.ingredient_name === 'Tulang Kambing')
  tracked.forEach(m => console.log(`  date=${m.date} | created=${m.created_at} | ${m.ingredient_name} qty=${m.qty} | ref=${m.ref}`))
  
  // Check if there's a Telor PO on Sept 23 that should be on Sept 22
  const { data: po23 } = await supabase.from('stock_movements').select('*').eq('type', 'Purchase').eq('date', '2026-09-23').eq('ingredient_name', 'Telor')
  console.log("\n=== SEPT 23 TELOR PURCHASES ===")
  po23.forEach(m => console.log(`  date=${m.date} | created=${m.created_at} | ${m.ingredient_name} qty=${m.qty}`))
  
  // Also check ALL telor purchases recently
  const { data: allTelorPO } = await supabase.from('stock_movements').select('*').eq('type', 'Purchase').eq('ingredient_name', 'Telor').gte('date', '2026-09-17')
  console.log("\n=== ALL RECENT TELOR PURCHASES ===")
  allTelorPO.forEach(m => console.log(`  date=${m.date} | created=${m.created_at} | qty=${m.qty} | ref=${m.ref}`))
}
run()
