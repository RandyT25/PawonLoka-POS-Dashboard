import { supabase } from './supabase'
import data from './ingredients_seed.json'

export async function seedIngredients() {
  let inserted = 0, updated = 0, errors = 0
  for (const ing of data) {
    const { data: existing } = await supabase
      .from('ingredients')
      .select('id,name,unit,sku')
      .eq('sku', ing.sku)
      .maybeSingle()

    const payload = {
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
    }

    if (existing) {
      // Only update if name or unit changed
      if (existing.name !== ing.name || existing.unit !== ing.unit) {
        await supabase.from('ingredients').update(payload).eq('id', existing.id)
        updated++
      }
    } else {
      const { error } = await supabase.from('ingredients').insert({
        id: 'ING-' + ing.sku.replace(/[^a-zA-Z0-9]/g,'').slice(0,12) + '-' + Math.random().toString(36).slice(2,6),
        ...payload
      })
      if (error) errors++
      else inserted++
    }
  }
  return { inserted, updated, errors }
}
