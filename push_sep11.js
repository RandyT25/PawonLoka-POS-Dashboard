import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function run() {
  const targetDate = '2026-09-11'
  
  // check if already pushed
  const { data: ex } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', targetDate)
  if (ex && ex.length > 0) {
    console.log("Already pushed!")
    return;
  }
  
  const { data: allIngredients } = await supabase.from('ingredients').select('id, name, unit, stock, cost_per_unit')
  const { data: recipes } = await supabase.from('recipes').select('productSku, ingredient_id, qty, unit, ingredient_name')
  const { data: orders } = await supabase.from('orders').select('id, items, status').eq('date', targetDate).eq('status', 'Paid')
  const { data: movements } = await supabase.from('stock_movements').select('ingredient_id, type, qty, date').eq('date', targetDate)
  const { data: existingRecon } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').order('submitted_at', { ascending: false }).limit(30)
  
  const { data: settings } = await supabase.from('app_settings').select('pos_behaviour').eq('id', 'main').single()
  const trackedIds = settings?.pos_behaviour?.daily_stock_items?.length ? settings.pos_behaviour.daily_stock_items : []
  
  const soldQty = {}
  const salesBreakdown = {}
  ;(orders||[]).forEach(order => {
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
  
  ;(movements||[]).forEach(m => {
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
    else if (m.type === 'Waste' || m.type === 'Staff Meal') {
      waste[ingId] = (waste[ingId] || 0) + Math.abs(qty)
    }
  })
  
  const prevDayRecon = existingRecon.find(r => r.data?.date && r.data.date < targetDate)
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
    
    let added = additions[id] || 0
    let sold = soldQty[id] || 0
    let wasted = waste[id] || 0
    let prodDed = production_deductions[id] || 0
    let adj = adjustments[id] || 0
    
    // Apply manual overrides based on user input
    if (ing.name === 'Sate Kambing (sub)') wasted += 4;
    if (ing.name === 'Ayam Taliwang (sub)') added += 10;
    
    const openingStock = prevCountsMap[id] !== undefined ? prevCountsMap[id] : 0
    const expectedSisa = Math.max(0, openingStock + added + adj - sold - wasted - prodDed)
    
    let actualQty = expectedSisa
    
    // Set manual actual quantities
    if (ing.name === 'Sate Kambing (sub)') actualQty = 247
    if (ing.name === 'Telor') actualQty = 83
    
    const diff = actualQty - expectedSisa
    
    items.push({
      name: ing.name,
      unit: ing.unit,
      diff_qty: diff,
      sold_qty: sold,
      added_qty: added,
      waste_qty: wasted,
      actual_qty: actualQty,
      diff_value: diff * (ing.cost_per_unit || 0),
      expected_qty: expectedSisa,
      cost_per_unit: ing.cost_per_unit || 0,
      ingredient_id: ing.id,
      opening_stock: openingStock,
      production_qty: prodDed,
      adj_qty: adj,
      sales_breakdown: salesBreakdown[id] || []
    })
  })
  
  const payload = {
    id: generateUUID(),
    type: 'daily_recon',
    status: 'pending',
    submitted_by: 'Randy', 
    submitted_at: new Date().toISOString(),
    data: {
      date: targetDate,
      items: items,
      notes: 'Auto-pushed from assistant (Sept 11th)',
      shift_id: 'full',
      staff_name: 'Randy',
      total_variance_value: items.reduce((sum, i) => sum + i.diff_value, 0)
    }
  }
  
  const res = await supabase.from('staff_submissions').insert(payload)
  if (res.error) {
    console.error("Failed to insert:", res.error)
  } else {
    console.log("Successfully Pushed Sep 11th!")
  }
  
  // Insert manual movements
  const sateKambing = allIngredients.find(i => i.name === 'Sate Kambing (sub)')
  const ayamTaliwang = allIngredients.find(i => i.name === 'Ayam Taliwang (sub)')
  
  await supabase.from('stock_movements').insert([
    { ingredient_id: sateKambing.id, type: 'Waste', qty: -4, date: targetDate, note: 'Waste (from paper)' },
    { ingredient_id: ayamTaliwang.id, type: 'Production', qty: 10, date: targetDate, note: 'Production (from paper)' }
  ])
  
  // Update live stocks to match exactly
  for (const it of items) {
     await supabase.from('ingredients').update({ stock: it.actual_qty }).eq('id', it.ingredient_id)
  }
  console.log("Updated live stock to match actual_qty")
}
run()
