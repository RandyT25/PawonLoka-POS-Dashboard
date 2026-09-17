import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: n_recs } = await supabase.from('recipes').select('*').eq('productSku', 'NAS035')
  console.log("Nasi Goreng Kambing recipe:")
  console.log(JSON.stringify(n_recs, null, 2))
}
run()
