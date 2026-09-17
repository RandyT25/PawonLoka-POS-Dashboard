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
    .limit(30)
  
  if (error) {
    console.error(error)
    return
  }
  
  for (const d of data) {
    const items = d.data.items || []
    let needsUpdate = false
    let newTotalVariance = 0

    const newItems = items.map(item => {
      // Re-calculate expected_qty based on final added_qty (Nita's input)
      const expected = Math.max(0, item.opening_stock + (item.added_qty||0) + (item.adj_qty||0) - (item.sold_qty||0) - (item.waste_qty||0) - (item.production_qty||0))
      
      const diffQty = item.actual_qty !== null ? (item.actual_qty - expected) : 0
      const diffVal = diffQty * (item.cost_per_unit || 0)

      if (expected !== item.expected_qty || diffQty !== item.diff_qty || diffVal !== item.diff_value) {
        needsUpdate = true
      }

      if (diffVal) {
          newTotalVariance += diffVal
      } else if (diffQty < 0) {
          newTotalVariance -= (Math.abs(diffQty) * (item.cost_per_unit || 0))
      }

      return {
        ...item,
        expected_qty: expected,
        diff_qty: diffQty,
        diff_value: diffVal
      }
    })

    if (needsUpdate) {
      console.log(`Fixing math for Report ID: ${d.id}`)
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
      else console.log(" -> Math fixed!")
    }
  }
}

run()
