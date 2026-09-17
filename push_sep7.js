import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const today = '2026-09-07'
  
  // check if already pushed
  const { data: ex } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', today)
  if (ex && ex.length > 0) {
    console.log("Already pushed!")
    return;
  }
  
  const { data: allIngredients } = await supabase.from('ingredients').select('id, name, unit, stock, cost_per_unit')
  const { data: recipes } = await supabase.from('recipes').select('productSku, ingredient_id, qty, unit, ingredient_name')
  const { data: todayOrders } = await supabase.from('orders').select('id, items, status').eq('date', today).eq('status', 'Paid')
  const { data: todayMovements } = await supabase.from('stock_movements').select('ingredient_id, type, qty, date').eq('date', today)
  const { data: existingRecon } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').order('submitted_at', { ascending: false }).limit(30)
  
  const targetItems = [
    'Sop Iga Kambing (sub)', 'Ayam Bumbu Kuning (sub)', 'Sate Kambing (sub)', 'Sate Ayam (sub)', 'Ayam Taliwang (sub)', 'Telor',
    // what about other critical items? let's get DEFAULT_CRITICAL_ITEMS from db
  ]
  const { data: settings } = await supabase.from('app_settings').select('pos_behaviour').eq('id', 'main').single()
  const trackedIds = settings?.pos_behaviour?.daily_stock_items?.length ? settings.pos_behaviour.daily_stock_items : []
  
  const soldQty = {}
  const salesBreakdown = {}
  todayOrders.forEach(order => {
    let items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
    items.forEach(it => {
      const matchRec = recipes.filter(r => r.productSku === it.sku)
      matchRec.forEach(r => {
        soldQty[r.ingredient_id] = (soldQty[r.ingredient_id] || 0) + (r.qty * it.qty)
        if (!salesBreakdown[r.ingredient_id]) salesBreakdown[r.ingredient_id] = []
        let existing = salesBreakdown[r.ingredient_id].find(sb => sb.menu === it.name)
        if (existing) {
          existing.orders += it.qty
          existing.total_used += r.qty * it.qty
        } else {
          salesBreakdown[r.ingredient_id].push({
            menu: it.name,
            unit: r.unit,
            orders: it.qty,
            total_used: r.qty * it.qty,
            per_portion: r.qty
          })
        }
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
  
  const items = []
  
  trackedIds.forEach(id => {
    const ing = allIngredients.find(i => i.id === id)
    if (!ing) return;
    
    const added = additions[id] || 0
    const sold = soldQty[id] || 0
    const wasted = waste[id] || 0
    const prodDed = production_deductions[id] || 0
    const adj = adjustments[id] || 0
    
    const openingStock = prevCountsMap[id] !== undefined ? prevCountsMap[id] : 0
    const expectedSisa = Math.max(0, openingStock + added + adj - sold - wasted - prodDed)
    
    items.push({
      name: ing.name,
      unit: ing.unit,
      diff_qty: 0,
      sold_qty: sold,
      added_qty: added,
      waste_qty: wasted,
      actual_qty: expectedSisa,
      diff_value: 0,
      expected_qty: expectedSisa,
      cost_per_unit: ing.cost_per_unit || 0,
      ingredient_id: ing.id,
      opening_stock: openingStock,
      sales_breakdown: salesBreakdown[id] || []
    })
  })
  
  const payload = {
    type: 'daily_recon',
    status: 'pending',
    submitted_by: 'Randy', // user
    submitted_at: new Date().toISOString(),
    data: {
      date: today,
      items: items,
      notes: 'Auto-pushed from assistant',
      shift_id: 'full',
      staff_name: 'Randy',
      total_variance_value: 0
    }
  }
  
  await supabase.from('staff_submissions').insert(payload)
  console.log("Pushed Sep 7th!")
  
  // Update live stocks to match exactly
  for (const it of items) {
     await supabase.from('ingredients').update({ stock: it.actual_qty }).eq('id', it.ingredient_id)
  }
  console.log("Updated live stock to match actual_qty")
}
run()
