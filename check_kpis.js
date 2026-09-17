import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon')
  let totalLoss = 0
  
  subs.forEach(sub => {
    let subLoss = 0
    let items = sub.data?.items || []
    items.forEach(item => {
      const diffQty = item.diff_qty || 0
      const unitCost = item.cost_per_unit || 0
      if (diffQty < 0) {
        subLoss += Math.abs(diffQty) * unitCost
        totalLoss += Math.abs(diffQty) * unitCost
      }
    })
    const date = sub.data?.date || sub.submitted_at.slice(0,10)
    console.log(`[${date}] Loss: ${subLoss}`)
  })
  
  console.log("GRAND TOTAL LOSS:", totalLoss)
}
run()
