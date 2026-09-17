import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data, error } = await supabase.from('ingredients').select('id, name').in('id', ['ING-170'])
  console.log(JSON.stringify(data, null, 2))
}
run()
