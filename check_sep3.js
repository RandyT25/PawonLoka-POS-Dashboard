import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', '2026-09-03%')
  if (subs.length > 0) {
    console.log("Sept 3 Recon exists!")
    const items = subs[0].data.items
    const tulang = items.find(it => it.ingredient_id === 'ING-201')
    console.log("Tulang Kambing:", tulang)
    const sopTul = items.find(it => it.ingredient_id === 'ING-1781533071195')
    console.log("Sop Tulang:", sopTul)
  } else {
    console.log("No Recon for Sept 3!")
  }
}
run()
