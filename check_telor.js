import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').order('submitted_at', { ascending: false })
  
  subs.forEach(s => {
    const d = s.data.date || s.submitted_at
    const telor = s.data.items.find(i => i.name === 'Telor')
    if (telor && d.startsWith('2026-09-1')) {
      console.log(`[${d}] Telor -> Open: ${telor.opening_stock}, Sold: ${telor.sold_qty}, Expected: ${telor.expected_qty}, Actual: ${telor.actual_qty}, Diff: ${telor.diff_qty}`)
    }
  })
}
run()
