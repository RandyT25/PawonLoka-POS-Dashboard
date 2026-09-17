import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data } = await supabase.from('staff_submissions')
    .select('*')
    .eq('type', 'daily_recon')
    .order('submitted_at', { ascending: false })
    .limit(3)
  
  data.forEach(d => {
    console.log(`ID: ${d.id}`)
    console.log(`Date in JSON: ${d.data.date}`)
    console.log(`Staff: ${d.data.staff_name}`)
    console.log(`Submitted At: ${d.submitted_at}`)
    console.log(`Notes: ${d.data.notes}`)
    console.log('---')
  })
}
run()
