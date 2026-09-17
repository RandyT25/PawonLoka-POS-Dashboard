import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', '2026-09-12%')
  let recon = subs[0]
  let items = recon.data.items
  
  console.log("SEPT 12 ITEMS:")
  items.forEach(i => {
    if (i.diff_qty !== 0) {
      console.log(`[${i.name}] diff_qty: ${i.diff_qty}, cost: ${i.cost_per_unit}, diff_value: ${i.diff_value}`)
    }
  })
  console.log("Total Variance Value:", recon.data.total_variance_value)
  
  const { data: s11 } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', '2026-09-11%')
  console.log("\nSEPT 11 ITEMS:")
  s11[0].data.items.forEach(i => {
    if (i.diff_qty !== 0) {
      console.log(`[${i.name}] diff_qty: ${i.diff_qty}, cost: ${i.cost_per_unit}, diff_value: ${i.diff_value}`)
    }
  })
  console.log("Total Variance Value:", s11[0].data.total_variance_value)
}
run()
