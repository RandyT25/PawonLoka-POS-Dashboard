import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-06')
  if (subs && subs.length > 0) {
    const d = subs[0].data;
    console.log("Sep 6th discrepancies:")
    d.items.forEach(it => {
      if (it.diff_qty !== 0) {
        console.log(`${it.name}: Expected ${it.expected_qty}, Actual ${it.actual_qty}, Diff ${it.diff_qty}`)
      }
    })
  } else {
    console.log("No sep 6 found")
  }
}
run()
