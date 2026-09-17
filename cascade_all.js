import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const dates = [
    '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06',
    '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
    '2026-09-11', '2026-09-12', '2026-09-13'
  ]
  
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i]
    
    // Fetch current day's movements to see if there are any new added_qty or production_qty
    const { data: movs } = await supabase.from('stock_movements').select('*').in('ingredient_id', ['ING-1781533071195', 'ING-201']).eq('date', d)
    
    let dailyAddedSop = 0
    let dailyProdTulang = 0
    
    movs.forEach(m => {
      if (m.ingredient_id === 'ING-1781533071195' && m.type === 'Yield') {
        dailyAddedSop += m.qty
      }
      if (m.ingredient_id === 'ING-201' && m.type === 'Production') {
        dailyProdTulang += Math.abs(m.qty) // Production is negative in movements, but positive in recon production_qty
      }
    })
    
    // Get prev day's recon to get the correct opening stock
    const prevD = new Date(new Date(d).getTime() - 86400000).toISOString().split('T')[0]
    const { data: prevSubs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', `${prevD}%`)
    
    let prevTulangKambing = 0
    let prevSopTulang = 0
    if (prevSubs && prevSubs.length > 0) {
      const pItems = prevSubs[0].data.items
      
      const pTul = pItems.find(it => it.ingredient_id === 'ING-201')
      if (pTul) prevTulangKambing = pTul.actual_qty
      
      const pSopTul = pItems.find(it => it.ingredient_id === 'ING-1781533071195')
      if (pSopTul) prevSopTulang = pSopTul.actual_qty
    }
    
    // Update current day's recon
    const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', `${d}%`)
    if (!subs || subs.length === 0) continue
    
    let recon = subs[0]
    let items = recon.data.items
    let changed = false
    
    // Process Tulang Kambing (ING-201)
    const tulang = items.find(it => it.ingredient_id === 'ING-201')
    if (tulang) {
      // Set the production_qty based on all movements we calculated
      if (tulang.production_qty !== dailyProdTulang) {
        tulang.production_qty = dailyProdTulang
        changed = true
      }
      if (prevSubs.length > 0 && tulang.opening_stock !== prevTulangKambing) {
        tulang.opening_stock = prevTulangKambing
        changed = true
      }
      
      if (changed) {
        tulang.expected_qty = (tulang.opening_stock || 0) + (tulang.added_qty || 0) + (tulang.adj_qty || 0) - (tulang.sold_qty || 0) - (tulang.waste_qty || 0) - (tulang.production_qty || 0)
        tulang.actual_qty = tulang.expected_qty
        tulang.diff_qty = 0
        tulang.diff_value = 0
      }
    }
    
    // Process Sop Tulang Kambing (ING-1781533071195)
    const sopTulang = items.find(it => it.ingredient_id === 'ING-1781533071195')
    if (sopTulang) {
      if (sopTulang.added_qty !== dailyAddedSop) {
        sopTulang.added_qty = dailyAddedSop
        changed = true
      }
      if (prevSubs.length > 0 && sopTulang.opening_stock !== prevSopTulang) {
        sopTulang.opening_stock = prevSopTulang
        changed = true
      }
      
      if (changed) {
        sopTulang.expected_qty = (sopTulang.opening_stock || 0) + (sopTulang.added_qty || 0) + (sopTulang.adj_qty || 0) - (sopTulang.sold_qty || 0) - (sopTulang.waste_qty || 0) - (sopTulang.production_qty || 0)
        sopTulang.actual_qty = sopTulang.expected_qty
        sopTulang.diff_qty = 0
        sopTulang.diff_value = 0
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
