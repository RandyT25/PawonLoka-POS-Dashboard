import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon')
  
  for (let sub of subs) {
    let items = sub.data.items || []
    let changed = false
    let totalVar = 0
    
    items.forEach(it => {
      if (it.diff_qty !== undefined && it.cost_per_unit !== undefined) {
        const correctVal = it.diff_qty * it.cost_per_unit
        if (Math.abs(correctVal - (it.diff_value || 0)) > 0.1 || (it.diff_qty > 0 && it.diff_value === 0)) {
          it.diff_value = correctVal
          changed = true
        }
        totalVar += correctVal
      }
    })
    
    if (Math.abs(totalVar - (sub.data.total_variance_value || 0)) > 0.1) {
      sub.data.total_variance_value = totalVar
      changed = true
    }
    
    if (changed) {
      const { error } = await supabase.from('staff_submissions').update({ data: sub.data }).eq('id', sub.id)
      if (error) console.log("ERROR on", sub.id, error)
      else console.log("Fixed historical math for", sub.data.date || sub.submitted_at.slice(0,10))
    }
  }
}
run()
