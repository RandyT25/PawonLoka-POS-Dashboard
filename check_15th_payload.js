import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789488000000').single()
  const telor = data.data.items.find(i => i.name === 'Telor')
  console.log(telor)
}
run()
