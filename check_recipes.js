import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: recs } = await supabase.from('recipes').select('*')
  
  // Tengkleng Iga
  console.log("Tengkleng Iga recipe uses Sop Iga Kambing (sub):")
  recs.filter(r => r.productSku === 'KAM014' || r.productSku === 'KAM015' || r.productName === 'Tengkleng Iga').forEach(r => console.log(r))

  // Nasi Goreng Kambing
  console.log("Nasi Goreng Kambing uses Sate Kambing (sub):")
  recs.filter(r => r.productSku === 'NAS035').forEach(r => console.log(r))
}
run()
