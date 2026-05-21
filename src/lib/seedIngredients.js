import { supabase } from './supabase'
import data from './ingredients_seed.json'

export async function seedIngredients() {
  let inserted = 0, skipped = 0
  for (const ing of data) {
    const { data: existing } = await supabase
      .from('ingredients')
      .select('id')
      .eq('sku', ing.sku)
      .single()
    if (existing) { skipped++; continue }
    await supabase.from('ingredients').insert({
      id: 'ING-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
      name: ing.name,
      sku: ing.sku,
      unit: ing.unit,
      category: ing.category || 'General',
      cost_per_unit: ing.cost_per_unit || 0,
      stock: 0,
      min_stock: 0,
      conversions: ing.conversions || [],
      last_purchase_price: 0,
      last_purchase_unit: '',
    })
    inserted++
  }
  console.log(`✅ Seeded: ${inserted} inserted, ${skipped} skipped`)
  return { inserted, skipped }
}
