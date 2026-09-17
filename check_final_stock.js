import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: ings } = await supabase.from('ingredients').select('id, name, stock').in('id', ['ING-1781533071195', 'ING-201', 'ING-200'])
  ings.forEach(i => console.log(`${i.name}: ${i.stock}`))
}
run()
