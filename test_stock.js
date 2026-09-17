import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: ings } = await supabase.from('ingredients').select('name, stock').in('name', ['Ayam Bumbu Kuning (sub)', 'Sop Iga Kambing (sub)', 'Telor'])
  console.log(ings)
}
run()
