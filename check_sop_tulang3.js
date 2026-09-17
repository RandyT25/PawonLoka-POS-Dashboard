import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: recs } = await supabase.from('recipes').select('*')
  console.log("Recipes for SUB-ING-1781533071195:")
  recs.filter(r => r.productSku === 'SUB-ING-1781533071195').forEach(r => console.log(`${r.qty} ${r.unit} of ${r.ingredient_name}`))
}
run()
