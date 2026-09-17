import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-05')
  for (const sub of subs) {
    const d = sub.data;
    d.items = d.items.map(it => {
      if (it.ingredient_id === 'ING-154') {
        it.added_qty = 0;
        it.expected_qty = 325;
        it.actual_qty = 325;
        it.diff_qty = 0;
      }
      if (it.ingredient_id === 'ING-183') {
        it.added_qty = 0;
        it.expected_qty = 81;
        it.actual_qty = 81;
        it.diff_qty = 0;
      }
      return it;
    })
    await supabase.from('staff_submissions').update({ data: d }).eq('id', sub.id)
  }
  console.log("Forced Sep 5")
}
run()
