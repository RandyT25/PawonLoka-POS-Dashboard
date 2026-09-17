import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: ings } = await supabase.from('ingredients').select('id, name, stock, unit').ilike('name', '%Kambing%')
  console.log("Kambing ingredients:")
  console.log(JSON.stringify(ings, null, 2))
  
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').order('created_at', { ascending: false }).limit(2)
  for (const sub of subs) {
    const d = sub.data
    const k = d.items.find(i => i.name.includes('Daging Kambing'))
    if (k) console.log(`In ${d.date}, Daging Kambing: expected=${k.expected_qty}, actual=${k.actual_qty}, diff=${k.diff_qty}`)
  }
}
run()
