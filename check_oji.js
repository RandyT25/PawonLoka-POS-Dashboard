import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: movs } = await supabase.from('stock_movements')
    .select('*')
    .in('type', ['Production'])
    .eq('actor', 'Oji')
    .order('created_at', { ascending: false })
    .limit(5)
    
  console.log("Oji Production Movements:")
  console.log(JSON.stringify(movs, null, 2))
}
run()
