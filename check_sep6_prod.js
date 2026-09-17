import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions')
    .select('*')
    .eq('type', 'production')
    .like('data->>date', '2026-09-06%')
    
  console.log("SEPTEMBER 6th PRODUCTIONS:")
  for (const s of subs) {
    const d = s.data
    console.log(`- ${d.item_name || d.output_name} (Yield: ${d.actual_yield}) at ${s.submitted_at}`)
    console.log(`  Ingredients used:`)
    if (d.ingredients_used) {
      d.ingredients_used.forEach(i => console.log(`    ${i.qty} ${i.unit} of ${i.name}`))
    }
  }
  
  console.log("\nSTOCK MOVEMENTS ON SEPT 6th FOR IGA/TULANG:")
  const { data: movs } = await supabase.from('stock_movements')
    .select('*')
    .in('ingredient_id', ['ING-200', 'ING-201', 'ING-170']) // Tulang Iga Kambing, Tulang Kambing, Sop Iga Kambing (sub)
    .eq('date', '2026-09-06')
    
  movs.forEach(m => console.log(`[${m.ingredient_name}] ${m.type}: ${m.qty} (Ref: ${m.ref})`))
}
run()
