import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: recs } = await supabase.from('recipes').select('*').ilike('product_name', '%Sop Tulang Kambing%')
  console.log("Recipes with product_name Sop Tulang Kambing:")
  recs.forEach(r => console.log(`${r.qty} ${r.unit} of ${r.ingredient_name}`))
}
run()
