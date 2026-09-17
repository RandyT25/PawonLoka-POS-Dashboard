import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const d = '2026-09-06'
  const prevD = new Date(new Date(d).getTime() - 86400000).toISOString().split('T')[0]
  console.log("prevD:", prevD)
  
  const { data: prevSubs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', `${prevD}%`)
  console.log("prevSubs length:", prevSubs.length)
  if (prevSubs.length > 0) {
    const pTul = prevSubs[0].data.items.find(it => it.ingredient_id === 'ING-201')
    console.log("Prev Tulang Kambing:", pTul)
  }
}
run()
