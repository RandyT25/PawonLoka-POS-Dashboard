import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const payload = {
    type: 'daily_recon',
    status: 'pending',
    submitted_by: 'Randy', 
    submitted_at: new Date().toISOString(),
    data: {
      date: '2026-09-07',
      items: [],
      notes: 'Auto-pushed from assistant',
      shift_id: 'full',
      staff_name: 'Randy',
      total_variance_value: 0
    }
  }
  const res = await supabase.from('staff_submissions').insert(payload)
  console.log(res.error)
}
run()
