import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions')
    .select('*')
    .eq('type', 'production')
    .like('data->>date', '2026-09-05%')
    
  console.log("SEPTEMBER 5th PRODUCTIONS:")
  for (const s of subs) {
    const d = s.data
    if ((d.item_name || '').includes('Iga')) {
      console.log(`- ${d.item_name} (Yield: ${d.actual_yield}) at ${s.submitted_at}`)
      console.log(`  Notes: ${d.notes}`)
    }
  }
}
run()
