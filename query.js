import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-06')
  if (subs.length > 0) {
    const sub = subs[0]
    const items = sub.data.items || []
    
    let totalDiff = 0
    items.forEach(it => {
      if (it.diff_value) {
        totalDiff += it.diff_value
        console.log(`${it.name}: diff_qty=${it.diff_qty}, diff_value=${it.diff_value}`)
      }
    })
    console.log("Total diff_value:", totalDiff)
    console.log("Submission totals:", sub.data.totals)
  }
}
run()
