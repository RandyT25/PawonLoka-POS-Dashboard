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
  
  if (error) {
    console.error(error)
    return
  }
  
  for (const d of data) {
    const items = d.data.items || []
    let needsUpdate = false
    let newTotalVariance = 0

    const newItems = items.map(item => {
      let added = item.added_qty;
      if (item.name.toLowerCase().includes('telor') && added === 120) {
        console.log(`Found Telor with 120 on report ${d.id}, changing to 110!`)
        added = 110;
        needsUpdate = true;
      }

      const expected = Math.max(0, item.opening_stock + (added||0) + (item.adj_qty||0) - (item.sold_qty||0) - (item.waste_qty||0) - (item.production_qty||0))
      const diffQty = item.actual_qty !== null ? (item.actual_qty - expected) : 0
      const diffVal = diffQty * (item.cost_per_unit || 0)

      if (diffVal) {
          newTotalVariance += diffVal
      } else if (diffQty < 0) {
          newTotalVariance -= (Math.abs(diffQty) * (item.cost_per_unit || 0))
      }

      return {
        ...item,
        added_qty: added,
        expected_qty: expected,
        diff_qty: diffQty,
        diff_value: diffVal
      }
    })

    if (needsUpdate) {
      console.log(`Updating Report ID: ${d.id}`)
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
      else console.log(" -> Math fixed and 120 changed to 110!")
    }
  }
}

run()
