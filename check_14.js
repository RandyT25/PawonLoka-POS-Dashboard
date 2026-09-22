import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: r14 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789402212788').single()
  
  console.log("=== SEPT 14 ===")
  r14.data.items.forEach(item => {
    if (item.diff_qty !== 0) {
      console.log(`${item.name}: Awal(${item.opening_stock}) + In(${item.added_qty}) - Out(${item.sold_qty}) - Waste(${item.waste_qty}) = Teori(${item.expected_qty}) | Fisik(${item.actual_qty}) => Diff(${item.diff_qty}) DiffVal(${item.diff_value})`)
    }
  })
}
run()
