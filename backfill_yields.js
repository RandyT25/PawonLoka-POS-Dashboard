import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions').select('*').eq('type', 'production').gte('submitted_at', '2026-09-12T16:00:00Z')
  
  const { data: allIngs } = await supabase.from('ingredients').select('*')
  
  for (const s of subs) {
    const data = s.data || {}
    const outputName = data.item_name || data.output_name || data.recipe?.name
    const yieldQty = data.actual_yield || data.yield_qty || data.expected_yield
    const yieldUnit = data.yield_unit || 'unknown'
    
    // Check if this yield already exists
    const { data: exist } = await supabase.from('stock_movements').select('*').eq('type', 'Production').eq('date', '2026-09-12').eq('ingredient_name', outputName).gt('qty', 0)
    
    if (exist && exist.length > 0) {
      console.log(`[SKIPPED] ${outputName} already has +${exist[0].qty} Yield`)
      continue
    }
    
    // Find ingredient ID
    const ing = allIngs.find(i => i.name === outputName)
    if (!ing) {
      console.log(`[ERROR] Ingredient not found for ${outputName}`)
      continue
    }
    
    const mov = {
      id: 'MOV-FIX-' + Math.random().toString(36).substr(2, 9),
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      type: 'Production',
      qty: yieldQty,
      unit: yieldUnit,
      date: '2026-09-12',
      time: '23.59',
      ref: s.id,
      note: 'Auto-backfill missing yield'
    }
    
    const { error } = await supabase.from('stock_movements').insert([mov])
    if (error) {
      console.log(`[ERROR] inserting ${outputName}:`, error)
    } else {
      console.log(`[SUCCESS] Backfilled +${yieldQty} for ${outputName}`)
      
      // Update Live Stock
      await supabase.from('ingredients').update({ stock: ing.stock + yieldQty }).eq('id', ing.id)
    }
  }
}
run()
