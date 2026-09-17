import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const today = '2026-09-07'
  const { data: allIngredients } = await supabase.from('ingredients').select('id, name, unit, stock')
  const { data: recipes } = await supabase.from('recipes').select('productSku, ingredient_id, qty, unit, ingredient_name')
  const { data: todayOrders } = await supabase.from('orders').select('id, items, status').eq('date', today).eq('status', 'Paid')
  const { data: todayMovements } = await supabase.from('stock_movements').select('ingredient_id, type, qty, date').eq('date', today)
  const { data: existingRecon } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').order('submitted_at', { ascending: false }).limit(30)
  
  const targetItems = ['Sop Iga Kambing (sub)', 'Ayam Bumbu Kuning (sub)', 'Sate Kambing (sub)', 'Sate Ayam (sub)', 'Ayam Taliwang (sub)', 'Telor']
  
  const soldQty = {}
  todayOrders.forEach(order => {
    let items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
    items.forEach(it => {
      const matchRec = recipes.filter(r => r.productSku === it.sku)
      matchRec.forEach(r => {
        soldQty[r.ingredient_id] = (soldQty[r.ingredient_id] || 0) + (r.qty * it.qty)
      })
    })
  })
  
  const additions = {}
  const waste = {}
  const adjustments = {}
  const production_deductions = {}
  
  todayMovements.forEach(m => {
    const qty = parseFloat(m.qty)
    const ingId = m.ingredient_id
    if (m.type === 'Purchase') additions[ingId] = (additions[ingId] || 0) + qty
    else if (m.type === 'Production') {
      if (qty > 0) additions[ingId] = (additions[ingId] || 0) + qty
      else production_deductions[ingId] = (production_deductions[ingId] || 0) + Math.abs(qty)
    }
    else if (m.type === 'Adjustment') {
      if (qty > 0) additions[ingId] = (additions[ingId] || 0) + qty
      else adjustments[ingId] = (adjustments[ingId] || 0) + Math.abs(qty)
    }
    else if (m.type === 'Waste') {
      waste[ingId] = (waste[ingId] || 0) + Math.abs(qty)
    }
  })
  
  const prevDayRecon = existingRecon.find(r => r.data?.date && r.data.date < today)
  const prevCountsMap = {}
  if (prevDayRecon?.data?.items) {
    prevDayRecon.data.items.forEach(it => {
      if (it.actual_qty !== undefined) prevCountsMap[it.ingredient_id] = it.actual_qty
    })
  }
  
  targetItems.forEach(name => {
    const ing = allIngredients.find(i => i.name === name)
    const ingId = ing.id
    
    const added = additions[ingId] || 0
    const sold = soldQty[ingId] || 0
    const wasted = waste[ingId] || 0
    const prodDed = production_deductions[ingId] || 0
    const adj = adjustments[ingId] || 0
    
    const openingStock = prevCountsMap[ingId] !== undefined ? prevCountsMap[ingId] : 0
    const expectedSisa = Math.max(0, openingStock + added + adj - sold - wasted - prodDed)
    
    console.log(`[${name}] Opening: ${openingStock}, Masuk: ${added}, Terjual: ${sold}, Waste: ${wasted}, ProdDed: ${prodDed}, Adj: ${adj} => Expected: ${expectedSisa}`)
  })
}
run()
