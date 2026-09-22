import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: r16 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789575677326').single()
  const sate = r16.data.items.find(i => i.name === 'Sate Kambing (sub)')
  const tulang = r16.data.items.find(i => i.name === 'Tulang Kambing')
  const daging = r16.data.items.find(i => i.name === 'Daging Kambing')
  console.log(sate.ingredient_id, tulang.ingredient_id, daging.ingredient_id)
}
run()
