import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-06')
  const d = subs[0].data;
  ['Sop Iga Kambing (sub)', 'Ayam Bumbu Kuning (sub)', 'Sate Kambing (sub)', 'Ayam Taliwang (sub)', 'Telor'].forEach(name => {
    const it = d.items.find(i => i.name === name)
    if (it) console.log(`${name}: actual=${it.actual_qty}`)
  })
}
run()
