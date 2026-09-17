import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('sub_recipes').select('*').ilike('name', '%Sop Tulang Kambing%')
  console.log("Sub Recipes:")
  console.log(subs)
  
  if (subs && subs.length > 0) {
    const { data: recs } = await supabase.from('recipes').select('*').eq('productSku', subs[0].id)
    console.log("\nIngredients for 1 batch:")
    recs.forEach(r => console.log(`${r.qty} ${r.unit} of ${r.ingredient_name}`))
  }
}
run()
