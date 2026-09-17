import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: orders } = await supabase.from('orders').select('id, items, status, type').eq('date', '2026-09-09')
  console.log("All orders on Sept 9th:")
  (orders||[]).forEach(o => {
    console.log(o.type, o.status, typeof o.items === 'string' ? JSON.parse(o.items).map(i => i.name) : o.items.map(i => i.name))
  })
}
run()
