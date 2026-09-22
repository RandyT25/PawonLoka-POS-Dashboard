import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: r15 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789488000000').single()
  const { data: r16 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789575677326').single()
  
  const a15 = r15.data.items.find(i => i.name.includes('Ayam Bumbu Kuning'))
  const a16 = r16.data.items.find(i => i.name.includes('Ayam Bumbu Kuning'))
  
  console.log("Sept 15 Ayam Bumbu Kuning:", { waste: a15.waste_qty, actual: a15.actual_qty, expected: a15.expected_qty })
  console.log("Sept 16 Ayam Bumbu Kuning:", { waste: a16.waste_qty, actual: a16.actual_qty, expected: a16.expected_qty })
}
run()
