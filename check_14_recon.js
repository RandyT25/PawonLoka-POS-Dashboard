import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: r14 } = await supabase.from('staff_submissions').select('submitted_at').eq('id', 'SS-RECON-1789402212788').single()
  console.log("Sept 14th report submitted at:", r14.submitted_at)
}
run()
