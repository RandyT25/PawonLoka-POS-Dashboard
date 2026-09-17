import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: prods } = await supabase.from('products').select('*').ilike('name', '%Tongseng Kambing%')
  console.log(prods)
  if (prods.length > 0) {
    const { data: recs } = await supabase.from('recipes').select('*').eq('productSku', prods[0].sku)
    console.log(recs)
  }
}
run()
