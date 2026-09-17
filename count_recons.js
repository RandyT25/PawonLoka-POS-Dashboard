import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { count, error } = await supabase
    .from('staff_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'daily_recon')
  
  if (error) {
    console.error(error)
    return
  }
  
  console.log("Total daily recons:", count)
}

run()
