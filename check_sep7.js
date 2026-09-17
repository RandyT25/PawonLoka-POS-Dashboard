import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-07')
  if (subs.length > 0) {
    const sub = subs[0]
    const check = ['Sop Iga', 'Ayam Bumbu Kuning (sub)', 'Sate Kambing (sub)', 'Sate Ayam (sub)', 'Ayam Taliwang (sub)', 'Telor', 'Sop Ayam']
    
    sub.data.items.forEach(it => {
      if (check.some(c => it.name.includes(c))) {
        console.log(`[${it.name}]`)
        console.log(`  opening: ${it.opening_stock}`)
        console.log(`  sold: ${it.sold_qty}`)
        console.log(`  added: ${it.added_qty}`)
        console.log(`  expected: ${it.expected_qty}`)
        console.log(`  actual: ${it.actual_qty}`)
        console.log(`  diff: ${it.diff_qty}`)
      }
    })
  } else {
    console.log("No Sep 7 submission found!")
  }
}
run()
