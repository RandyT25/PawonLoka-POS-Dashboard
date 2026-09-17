import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('staff_submissions')
    .select('*')
    .eq('type', 'daily_recon')
    .limit(10)
  
  if (error) {
    console.error(error)
    return
  }
  
  for (const d of data) {
    const items = d.data.items || []
    const telor = items.find(i => i.name.toLowerCase().includes('telor'))
    if (telor && telor.diff_qty !== 0) {
      console.log(`Report ID: ${d.id}`)
      console.log(telor)
    }
  }
}

run()
