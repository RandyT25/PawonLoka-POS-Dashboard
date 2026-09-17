import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const dates = [
    '2026-09-06',
    '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
    '2026-09-11', '2026-09-12'
  ]
  
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i]
    
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
    
    const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').like('data->>date', `${d}%`)
    if (!subs || subs.length === 0) continue
    
    let recon = subs[0]
    let items = recon.data.items
    
    // Process Tulang Kambing (ING-201)
    const tulang = items.find(it => it.ingredient_id === 'ING-201')
    if (tulang) {
      tulang.opening_stock = prevTulangKambing
      tulang.expected_qty = (tulang.opening_stock || 0) + (tulang.added_qty || 0) + (tulang.adj_qty || 0) - (tulang.sold_qty || 0) - (tulang.waste_qty || 0) - (tulang.production_qty || 0)
      tulang.actual_qty = tulang.expected_qty
      tulang.diff_qty = 0
      tulang.diff_value = 0
    }
    
    // Process Sop Tulang Kambing (ING-1781533071195)
    const sopTulang = items.find(it => it.ingredient_id === 'ING-1781533071195')
    if (sopTulang) {
      sopTulang.opening_stock = prevSopTulang
      sopTulang.expected_qty = (sopTulang.opening_stock || 0) + (sopTulang.added_qty || 0) + (sopTulang.adj_qty || 0) - (sopTulang.sold_qty || 0) - (sopTulang.waste_qty || 0) - (sopTulang.production_qty || 0)
      sopTulang.actual_qty = sopTulang.expected_qty
      sopTulang.diff_qty = 0
      sopTulang.diff_value = 0
    }
    
    recon.data.total_variance_value = items.reduce((sum, it) => sum + (it.diff_value || 0), 0)
    await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', recon.id)
    console.log(`Force Updated ${d}`)
  }
}
run()
