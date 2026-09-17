import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-08')
  if(subs && subs.length > 0) {
    let sub = subs[0]
    let mod = false
    sub.data.items = sub.data.items.map(it => {
      if (it.name === 'Telor') {
        it.adj_qty = -2 // Must be negative to deduct
        it.expected_qty = 115
        it.actual_qty = 115
        it.diff_qty = 0
        mod = true
      }
      return it
    })
    if(mod) {
      await supabase.from('staff_submissions').update({ data: sub.data }).eq('id', sub.id)
      console.log("Updated Sep 8 JSON to fix +2 to -2")
    }
  }
}
run()
