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
    .eq('id', 'SS-RECON-1789315827820')
  
  if (error) {
    console.error(error)
    return
  }
  
  for (const d of data) {
    const items = d.data.items || []
    let newTotalVariance = 0

    const newItems = items.map(item => {
      if (item.name.toLowerCase().includes('telor')) {
        console.log(`Found Telor on report ${d.id}, changing actual_qty from ${item.actual_qty} to 133!`)
        
        const expected = Math.max(0, item.opening_stock + (item.added_qty||0) + (item.adj_qty||0) - (item.sold_qty||0) - (item.waste_qty||0) - (item.production_qty||0))
        const diffQty = 133 - expected
        const diffVal = diffQty * (item.cost_per_unit || 0)

        if (diffVal) {
            newTotalVariance += diffVal
        } else if (diffQty < 0) {
            newTotalVariance -= (Math.abs(diffQty) * (item.cost_per_unit || 0))
        }

        return {
          ...item,
          actual_qty: 133,
          expected_qty: expected,
          diff_qty: diffQty,
          diff_value: diffVal
        }
      } else {
        if (item.diff_value) {
            newTotalVariance += item.diff_value
        } else if (item.diff_qty < 0) {
            newTotalVariance -= (Math.abs(item.diff_qty) * (item.cost_per_unit || 0))
        }
        return item
      }
    })

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
    else console.log(" -> Math fixed and actual_qty changed to 133!")
  }
}

run()
