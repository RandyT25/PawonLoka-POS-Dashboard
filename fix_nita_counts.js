import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const reconId = 'SS-RECON-1789285791613'
  
  const { data: recons } = await supabase.from('staff_submissions').select('*').eq('id', reconId)
  if (recons.length > 0) {
    let recon = recons[0]
    let items = recon.data.items
    
    // Fix Sop Iga Kambing (sub) to 28
    let sop = items.find(i => i.ingredient_id === 'ING-170')
    if (sop) {
      sop.actual_qty = 28
      sop.diff_qty = 0
      sop.diff_value = 0
      console.log("Fixed Sop Iga Kambing (sub) actual to 28")
    }
    
    // Fix Tulang Iga Kambing to 10000
    let tulangIga = items.find(i => i.ingredient_id === 'ING-200')
    if (tulangIga) {
      tulangIga.actual_qty = 10000
      tulangIga.diff_qty = 0
      tulangIga.diff_value = 0
      console.log("Fixed Tulang Iga Kambing actual to 10000")
    }
    
    // Recalculate total variance
    recon.data.total_variance_value = items.reduce((sum, i) => sum + i.diff_value, 0)
    
    const { error } = await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', reconId)
    if (error) {
      console.log("Error updating recon:", error)
    } else {
      console.log("Successfully fixed Nita's miscounts!")
    }
  }
}
run()
