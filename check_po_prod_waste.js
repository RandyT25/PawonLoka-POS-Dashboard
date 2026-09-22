import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const dates = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22']
  
  for (const date of dates) {
    const { data: moves } = await supabase.from('stock_movements').select('*').eq('date', date)
    
    // Filter only the tracked items
    const trackedIds = ['ING-1780245811602', 'ING-007', 'ING-1781766220889', 'ING-183', 'ING-154', 'ING-155', 'ING-200', 'ING-201', 'ING-046']
    const filtered = moves.filter(m => trackedIds.includes(m.ingredient_id))
    
    if (filtered.length > 0) {
      console.log(`\n=== ${date} movements for tracked items ===`)
      filtered.forEach(m => {
        console.log(`  ${m.type} | ${m.ingredient_name} | qty: ${m.qty} | ref: ${m.ref} | note: ${m.note}`)
      })
    }
  }
}
run()
