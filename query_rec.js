import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: recs } = await supabase.from('recipes').select('*').limit(1)
  if (recs) {
    console.log(Object.keys(recs[0]))
    const { data: n_recs } = await supabase.from('recipes').select('*').eq('product_sku', 'NAS035')
    console.log(n_recs)
  }
}
run()
