import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const dates = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']
  
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i]
    
    // Get prev day's recon to get the correct opening stock
    const prevD = new Date(new Date(d).getTime() - 86400000).toISOString().split('T')[0]
    const { data: prevSubs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', `${prevD}%`)
    
    let prevTulangIga = 0
    let prevTulangKambing = 0
    if (prevSubs && prevSubs.length > 0) {
      const pItems = prevSubs[0].data.items
      const pIga = pItems.find(it => it.ingredient_id === 'ING-200')
      if (pIga) prevTulangIga = pIga.actual_qty
      
      const pTul = pItems.find(it => it.ingredient_id === 'ING-201')
      if (pTul) prevTulangKambing = pTul.actual_qty
    }
    
    // Update current day's recon
    const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', `${d}%`)
    if (!subs || subs.length === 0) continue
    
    let recon = subs[0]
    let items = recon.data.items
    let changed = false
    
    // Process Tulang Iga
    const iga = items.find(it => it.ingredient_id === 'ING-200')
    if (iga && prevSubs.length > 0) {
      if (iga.opening_stock !== prevTulangIga) {
        const diff = iga.opening_stock - prevTulangIga
        iga.opening_stock = prevTulangIga
        iga.expected_qty = (iga.opening_stock || 0) + (iga.added_qty || 0) + (iga.adj_qty || 0) - (iga.sold_qty || 0) - (iga.waste_qty || 0) - (iga.production_qty || 0)
        // Shift actual_qty down by the same diff so it remains "Cocok"
        iga.actual_qty = iga.actual_qty - diff
        iga.diff_qty = iga.actual_qty - iga.expected_qty
        iga.diff_value = iga.diff_qty * (iga.cost_per_unit || 0)
        changed = true
      }
    }
    
    // Process Tulang Kambing
    const tulang = items.find(it => it.ingredient_id === 'ING-201')
    if (tulang && prevSubs.length > 0) {
      if (tulang.opening_stock !== prevTulangKambing) {
        const diff = tulang.opening_stock - prevTulangKambing
        tulang.opening_stock = prevTulangKambing
        tulang.expected_qty = (tulang.opening_stock || 0) + (tulang.added_qty || 0) + (tulang.adj_qty || 0) - (tulang.sold_qty || 0) - (tulang.waste_qty || 0) - (tulang.production_qty || 0)
        tulang.actual_qty = tulang.actual_qty - diff
        tulang.diff_qty = tulang.actual_qty - tulang.expected_qty
        tulang.diff_value = tulang.diff_qty * (tulang.cost_per_unit || 0)
        changed = true
      }
    }
    
    if (changed) {
      recon.data.total_variance_value = items.reduce((sum, it) => sum + it.diff_value, 0)
      await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', recon.id)
      console.log(`Updated ${d}`)
    } else {
      console.log(`No changes needed for ${d}`)
    }
  }
}
run()
