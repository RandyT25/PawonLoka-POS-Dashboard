import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('staff_submissions')
    .select('id, submitted_at, data')
    .eq('type', 'daily_recon')
  
  if (error) {
    console.error(error)
    return
  }
  
  const sept15 = data.filter(d => d.submitted_at.startsWith('2026-09-15'))
  console.log(`Found ${sept15.length} reports on Sept 15th.`)
  sept15.forEach(d => console.log(d.id, d.submitted_at))
}

run()
