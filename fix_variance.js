import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon')
  
  for (const sub of subs) {
    let recalculated = 0;
    sub.data.items.forEach(it => {
      if (it.diff_value) recalculated += it.diff_value;
    })
    
    // Some logic in POS might make variance absolute or not, but typically total_variance_value is the sum of diff_value.
    // Wait, let's see if 33779 was positive or negative. "diff_value = 33779" -> UI shows "-Rp 33.779". So it's raw value.
    if (sub.data.total_variance_value !== recalculated) {
      console.log(`Fixing ${sub.data.date} total_variance_value from ${sub.data.total_variance_value} to ${recalculated}`)
      sub.data.total_variance_value = recalculated;
      await supabase.from('staff_submissions').update({ data: sub.data }).eq('id', sub.id)
    }
  }
}
run()
