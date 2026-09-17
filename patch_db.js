import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('staff_submissions')
    .select('*')
    .eq('type', 'daily_recon')
    .order('submitted_at', { ascending: false })
    .limit(20)
  
  if (error) {
    console.error(error)
    return
  }
  
  for (const d of data) {
    const items = d.data.items || []
    const hasSopIga = items.find(i => i.id === 'ING-170' || i.name.toLowerCase().includes('sop iga'))
    if (hasSopIga) {
      console.log(`Patching Report ID: ${d.id}...`)
      const newItems = items.filter(i => i.id !== 'ING-170' && !i.name.toLowerCase().includes('sop iga'))
      
      // Recalculate totals if needed
      let newTotalVariance = 0
      newItems.forEach(it => {
        if (it.diff_value) {
            newTotalVariance += it.diff_value
        } else if (it.diff_qty < 0) {
            newTotalVariance -= (Math.abs(it.diff_qty) * (it.cost_per_unit || 0))
        }
      })

      const newData = {
        ...d.data,
        items: newItems,
        total_variance_value: newTotalVariance
      }

      const { error: updErr } = await supabase
        .from('staff_submissions')
        .update({ data: newData })
        .eq('id', d.id)
      
      if (updErr) console.error("Error updating", d.id, updErr)
      else console.log("Successfully removed Sop Iga from", d.id)
    }
  }
}

run()
