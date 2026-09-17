import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'production').gte('submitted_at', '2026-09-12T16:00:00Z')
  
  for (const s of subs) {
    // try to find what they produced
    const data = s.data || {}
    const outputName = data.output_name || data.recipe?.name || JSON.stringify(data)
    const yieldQty = data.actual_yield || data.yield_qty || data.expected_yield
    console.log(`Submitted: ${s.submitted_at}, Yield: ${yieldQty} of ${outputName}`)
  }
}
run()
