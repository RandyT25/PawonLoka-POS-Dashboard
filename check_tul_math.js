import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', '2026-09-06%')
  if (subs.length > 0) {
    const items = subs[0].data.items
    const tulang = items.find(i => i.ingredient_id === 'ING-201')
    console.log("Sept 6th Recon for Tulang Kambing:")
    console.log(tulang)
  }
}
run()
