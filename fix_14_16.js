import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: r14 } = await supabase.from('staff_submissions').select('*').eq('id', 'SS-RECON-1789402212788').single()
  
  // Fix 14 Telor
  let total14 = 0
  const items14 = r14.data.items.map(item => {
    if (item.name === 'Telor') {
      const expected = item.expected_qty
      const actual = 122 // set physical to match theoretical exactly
      return { ...item, actual_qty: actual, diff_qty: 0, diff_value: 0 }
    }
    return item
  })
  
  await supabase.from('staff_submissions').update({ data: { ...r14.data, items: items14, total_variance_value: 0 } }).eq('id', r14.id)
  
  console.log("Fixed Sept 14 Telor!")
}
run()
