import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data } = await supabase.from('recipes').select('*')
  data.filter(r => r.ingredient_name.includes('Iga Kambing') || r.ingredient_name.includes('Sop Iga Kambing')).forEach(r => {
    console.log(`Product SKU ${r.product_id} uses ${r.qty} ${r.unit} of ${r.ingredient_name}`)
  })
}
run()
