import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: r15 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789488000000').single()
  
  const handwritten = ['Sop Ayam (sub)', 'Ayam Bumbu Kuning (sub)', 'Sate Kambing (sub)', 'Sate Ayam (sub)', 'Ayam Taliwang (sub)', 'Telor']
  
  console.log("=== CROSS CHECK SEPT 15 ===")
  r15.data.items.forEach(item => {
    if (handwritten.includes(item.name)) {
      const match = item.expected_qty === item.actual_qty ? "MATCH" : "MISMATCH"
      console.log(`${item.name}: Awal(${item.opening_stock}) + In(${item.added_qty}) - Out(${item.sold_qty}) - Waste(${item.waste_qty}) = Teori(${item.expected_qty}) | Fisik(${item.actual_qty}) => Diff(${item.diff_qty}) [${match}]`)
    }
  })
}
run()
