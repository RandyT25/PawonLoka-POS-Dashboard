import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: orders, error } = await supabase.from('orders').select('*').eq('date', '2026-09-09')
  console.log(error)
  console.log("All orders on Sept 9th:", orders?.length);
  (orders || []).forEach(o => {
    console.log(o.payment_method, o.status, typeof o.items === 'string' ? JSON.parse(o.items).map(i => i.name) : o.items.map(i => i.name))
  })
}
run()
