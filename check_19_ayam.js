import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Sept 19 recon shows added_qty=15 for Ayam BK but expected=47, actual=37 => diff=-10
  // Sold was 4 (2+1+1). Opening was 36.
  // 36 + 15 - 4 = 47. Physical = 37. So -10 is REAL variance.
  // The +15 WAS picked up. The issue is the 10 extra were consumed but not tracked.
  
  // But wait - let me check: is the `added_qty: 15` actually from the Production output?
  // Or is it from a PO? Let's check Sept 19 movements for Ayam BK
  const { data: moves } = await supabase.from('stock_movements').select('*')
    .eq('date', '2026-09-19')
    .eq('ingredient_id', 'ING-1780245811602')
  
  console.log("=== Sept 19 Ayam BK Movements ===")
  moves.forEach(m => console.log(`  ${m.type} | qty=${m.qty} | ref=${m.ref} | created=${m.created_at}`))
  
  // Now the key question: did the production create a +15 movement with date=2026-09-19?
  // If yes, the recon correctly picked it up. The -10 is a genuine variance.
}
run()
