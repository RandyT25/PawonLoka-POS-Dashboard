import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // 1. Delete the bad PO on Sept 14th
  console.log("Deleting bad PO on Sept 14th...")
  await supabase
    .from('stock_movements')
    .delete()
    .eq('type', 'Purchase')
    .eq('ingredient_name', 'Telor')
    .eq('date', '2026-09-14')
    .eq('qty', 110)

  // 2. Fetch all daily_recon reports from Sept 13th onwards
  const { data: reports, error } = await supabase
    .from('staff_submissions')
    .select('*')
    .eq('type', 'daily_recon')
    .order('submitted_at', { ascending: true })
  
  if (error) {
    console.error(error)
    return
  }

  // Filter to reports that have Telor and are from Sept 13th onwards
  const telorReports = reports.filter(r => {
    return new Date(r.submitted_at) >= new Date('2026-09-13T00:00:00Z')
  })

  let prevActualQty = 133; // From Sept 13th

  for (let i = 0; i < telorReports.length; i++) {
    const d = telorReports[i]
    let newTotalVariance = 0

    const newItems = d.data.items.map(item => {
      if (item.name.toLowerCase().includes('telor')) {
        let added = item.added_qty
        let opening = item.opening_stock

        // If it's Sept 14th (the report immediately after Sept 13th), force added to 0
        if (d.submitted_at.startsWith('2026-09-14')) {
          added = 0
        }

        // The opening stock MUST be the physical count from the previous report!
        // Except for the very first one in this loop (Sept 13), which we already fixed
        if (d.submitted_at.startsWith('2026-09-13')) {
          prevActualQty = item.actual_qty // Should be 133
        } else {
          opening = prevActualQty
        }

        const expected = Math.max(0, opening + (added||0) + (item.adj_qty||0) - (item.sold_qty||0) - (item.waste_qty||0) - (item.production_qty||0))
        const diffQty = item.actual_qty !== null ? (item.actual_qty - expected) : 0
        const diffVal = diffQty * (item.cost_per_unit || 0)

        // Store this actual_qty for the next day's opening stock
        prevActualQty = item.actual_qty

        if (diffVal) {
            newTotalVariance += diffVal
        } else if (diffQty < 0) {
            newTotalVariance -= (Math.abs(diffQty) * (item.cost_per_unit || 0))
        }

        console.log(`Report ${d.submitted_at.slice(0,10)} -> Awal: ${opening}, Masuk: ${added}, Terjual: ${item.sold_qty}, Teori: ${expected}, Fisik: ${item.actual_qty}, Selisih: ${diffQty}`)

        return {
          ...item,
          opening_stock: opening,
          added_qty: added,
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

    const newData = {
      ...d.data,
      items: newItems,
      total_variance_value: newTotalVariance
    }

    await supabase
      .from('staff_submissions')
      .update({ data: newData })
      .eq('id', d.id)
  }
  
  console.log("Chain rebuilt successfully!")
}

run()
