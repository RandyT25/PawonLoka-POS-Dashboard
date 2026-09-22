import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Get all recon reports from Sept 18-22
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').order('submitted_at', { ascending: false }).limit(30)
  
  const dates = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22']
  
  for (const date of dates) {
    const reports = subs.filter(s => s.data?.date === date)
    console.log(`\n=== ${date} (${reports.length} report(s)) ===`)
    
    for (const r of reports) {
      console.log(`  Report ID: ${r.id}`)
      r.data.items.forEach(item => {
        if (item.diff_qty !== 0) {
          console.log(`  ❌ ${item.name}: Awal(${item.opening_stock}) +Masuk(${item.added_qty}) -Sold(${item.sold_qty}) -Waste(${item.waste_qty}) -Prod(${item.production_qty}) Adj(${item.adj_qty}) = Teori(${item.expected_qty}) | Fisik(${item.actual_qty}) => Diff(${item.diff_qty}) Val(${item.diff_value})`)
        }
      })
      const allMatch = r.data.items.every(i => i.diff_qty === 0)
      if (allMatch) console.log(`  ✅ All items match`)
    }
  }
}
run()
