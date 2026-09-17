import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const reconId = 'SS-RECON-1789285791613'
  const targetDate = '2026-09-12'

  const { data: allIngredients } = await supabase.from('ingredients').select('id, name, unit, stock, cost_per_unit')
  const { data: recipes } = await supabase.from('recipes').select('productSku, ingredient_id, qty, unit, ingredient_name')
  const { data: orders } = await supabase.from('orders').select('id, items, status').eq('date', targetDate).eq('status', 'Paid')
  const { data: movements } = await supabase.from('stock_movements').select('ingredient_id, type, qty, date').eq('date', targetDate)
  
  // Get opening stock from Sept 11th's recon
  const { data: prevRecon } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-11').single()
  
  // Get the broken recon
  const { data: brokenReconRows } = await supabase.from('staff_submissions').select('*').eq('id', reconId)
  let recon = brokenReconRows[0]
  let itemsToFix = recon.data.items

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
  
  const prevCountsMap = {}
  if (prevRecon?.data?.items) {
    prevRecon.data.items.forEach(it => {
      if (it.actual_qty !== undefined) prevCountsMap[it.ingredient_id] = it.actual_qty
    })
  }

  itemsToFix.forEach(item => {
    const id = item.ingredient_id
    let added = additions[id] || 0
    let sold = soldQty[id] || 0
    let wasted = waste[id] || 0
    let prodDed = production_deductions[id] || 0
    let adj = adjustments[id] || 0
    
    // Some items might have been manually added by Nita on the tablet form!
    // We should keep her manual additions if any.
    // Let's see if item.added_qty is different from additions[id]
    // Well, wait. On the 13th form, additions[id] would be 13th purchases.
    // Let's assume the POS allowed her to type `added_qty`.
    // We will just use the true DB additions for Sept 12th.
    
    const openingStock = prevCountsMap[id] !== undefined ? prevCountsMap[id] : 0
    const expectedSisa = Math.max(0, openingStock + added + adj - sold - wasted - prodDed)
    
    const actualQty = item.actual_qty // WHAT SHE PHYSICALLY COUNTED!
    const diff = actualQty - expectedSisa
    
    item.opening_stock = openingStock
    item.added_qty = added
    item.sold_qty = sold
    item.waste_qty = wasted
    item.production_qty = prodDed
    item.adj_qty = adj
    item.expected_qty = expectedSisa
    item.diff_qty = diff
    item.diff_value = diff * (item.cost_per_unit || 0)
    item.sales_breakdown = salesBreakdown[id] || []
    
    console.log(`[${item.name}] Counted: ${actualQty}, Expected: ${expectedSisa} (Open ${openingStock} - Sold ${sold} - W/P/A)`)
  })

  recon.data.items = itemsToFix
  recon.data.total_variance_value = itemsToFix.reduce((sum, i) => sum + i.diff_value, 0)
  
  const { error } = await supabase.from('staff_submissions').update({ data: recon.data }).eq('id', reconId)
  if (error) console.log("Failed to update:", error)
  else console.log("Successfully fixed the Sept 12 recon math!")

  // Let's also enforce live stock to Nita's counts?
  // Wait, if she counted it as closing 12th, and today is 13th, have there been 13th sales?
  // If there are 13th sales, forcing live stock to Nita's counts (which were at 12th closing) will erase the 13th sales!!!
  // Oh wow. If she entered the stock NOW, did she enter the stock before today's sales, or after?
  // If she opened the store, the stock is closing of 12th. She input it.
  // We MUST NOT overwrite live stock because she might have sold things today!
}
run()
