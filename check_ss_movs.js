import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data } = await supabase.from('stock_movements').select('*').eq('ref', 'SS-1789142793658')
  console.log("Movements for SS-1789142793658:")
  data.forEach(d => console.log(d.id, d.ingredient_name, d.type, d.qty, d.note))
}
run()
