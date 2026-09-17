import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data } = await supabase.from('staff_submissions').select('*').in('type', ['production', 'daily_recon']).gte('submitted_at', '2026-09-11T15:00:00Z')
  console.log("Submissions >= Sept 11 late:")
  data.forEach(d => {
    console.log(d.id, d.type, d.submitted_at, d.data.date, d.data.notes)
    if (d.type === 'production') {
      const items = d.data.items || d.data.output_items || []
      items.forEach(i => console.log('  ', i.ingredient_name, i.qty))
    }
  })
}
run()
