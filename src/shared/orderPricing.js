// Single source of truth for order pricing math. Every write to the `orders`
// table's items/subtotal/tax/discount/total must go through this function so
// those fields can never be written out of sync with each other.
export function computeOrderTotals({ items, discountPct = 0, promoDisc = 0, pointsValue = 0, taxRate = 0 }) {
  const grossSubtotal = items.reduce((s, i) => s + (i.price * i.qty), 0)
  const subtotal = items.reduce((s, i) => s + (i.price - (i.itemDisc || 0)) * i.qty, 0)
  const discAmt = discountPct ? Math.round(grossSubtotal * discountPct / 100) : 0
  const discount = discAmt + promoDisc + pointsValue
  const netBeforeTax = Math.max(0, subtotal - discount)
  const tax = Math.round(netBeforeTax * taxRate)
  const total = netBeforeTax + tax
  return { items, subtotal, tax, discount, total }
}

const DEFAULT_ONLINE_MARKUP = {
  GoFood: 20,
  GrabFood: 20,
  ShopeeFood: 20,
}

export const DEFAULT_PAYMENT_METHODS = [
  { id: 'Cash',       name: 'Cash',          icon: '💵', note: '',                        enabled: true,  surcharge: 0 },
  { id: 'QRIS',       name: 'QRIS',          icon: '📲', note: 'T+1 settlement',          enabled: true,  surcharge: 0 },
  { id: 'Card',       name: 'Debit/Credit',  icon: '💳', note: '',                        enabled: true,  surcharge: 0 },
  { id: 'GoFood',     name: 'GoFood',        icon: '🚴', note: 'Online App (+20% harga)', enabled: true,  surcharge: 20, isOnlineApp: true },
  { id: 'GrabFood',   name: 'GrabFood',      icon: '🟢', note: 'Online App (+20% harga)', enabled: true,  surcharge: 20, isOnlineApp: true },
  { id: 'ShopeeFood', name: 'ShopeeFood',    icon: '🛍️', note: 'Online App (+20% harga)', enabled: true,  surcharge: 20, isOnlineApp: true },
  { id: 'Transfer',   name: 'Bank Transfer', icon: '🏦', note: 'T+1 settlement',          enabled: false, surcharge: 0 },
  { id: 'GoPay',      name: 'GoPay',         icon: '🟦', note: 'T+1 settlement',          enabled: false, surcharge: 0 },
  { id: 'OVO',        name: 'OVO',           icon: '🟣', note: 'T+1 settlement',          enabled: false, surcharge: 0 },
  { id: 'ShopeePay',  name: 'ShopeePay',     icon: '🧡', note: 'T+1 settlement',          enabled: false, surcharge: 0 },
  { id: 'DANA',       name: 'DANA',          icon: '🔵', note: 'T+1 settlement',          enabled: false, surcharge: 0 },
]

// Merge stored `app_settings.payments.methods` with DEFAULT_PAYMENT_METHODS so:
// 1. GoFood, GrabFood, and ShopeeFood are always present and enabled by default
//    even if the DB row was saved before they existed.
// 2. Any custom payment methods added by the user in Backoffice are preserved.
export function mergePaymentMethods(savedMethods) {
  if (!Array.isArray(savedMethods) || savedMethods.length === 0) {
    return DEFAULT_PAYMENT_METHODS.map(m => ({ ...m }))
  }
  const merged = DEFAULT_PAYMENT_METHODS.map(def => {
    const sv = savedMethods.find(m => m.id === def.id)
    if (!sv) return { ...def }
    const cleanSurcharge = (def.id === 'Card' && sv.surcharge === 1.5) ? 0 : (sv.surcharge ?? def.surcharge ?? 0)
    return {
      ...def,
      ...sv,
      icon: sv.icon || def.icon,
      name: sv.name || def.name,
      surcharge: Number(cleanSurcharge) || 0,
    }
  })
  // Preserve any user-created custom payment methods
  for (const sv of savedMethods) {
    if (!merged.some(m => m.id === sv.id)) {
      merged.push({
        id: sv.id,
        name: sv.name || sv.id,
        icon: sv.icon || '💳',
        note: sv.note || '',
        enabled: sv.enabled !== false,
        surcharge: Number(sv.surcharge) || 0,
        isCustom: true,
        isOnlineApp: !!sv.isOnlineApp || (Number(sv.surcharge) || 0) > 0,
      })
    }
  }
  return merged
}

// Look up the configured markup/surcharge percentage for a payment method or order type.
// For online food apps (GoFood, GrabFood, ShopeeFood), defaults to 20% if not explicitly set.
export function getMethodMarkupPct(methodOrType, payMethods = []) {
  if (!methodOrType) return 0
  const found = (payMethods || []).find(
    m => m.id === methodOrType || m.name === methodOrType || m.label === methodOrType
  )
  if (found && found.surcharge !== undefined && found.surcharge !== null && found.surcharge !== '') {
    if (found.id === 'Card' && Number(found.surcharge) === 1.5) return 0
    const parsed = Number(found.surcharge)
    if (!Number.isNaN(parsed)) return Math.max(0, parsed)
  }
  return DEFAULT_ONLINE_MARKUP[methodOrType] || 0
}

// Safely scale cart/order items from their in-house base price (`_inHousePrice`)
// by `markupPct` (e.g. +20% for GoFood/GrabFood/ShopeeFood, 0% for Dine-in/Delivery/Cash/QRIS).
// Always derives from `_inHousePrice` so switching between 0% and +20% never compounds.
export function applyChannelMarkupToItems(items = [], markupPct = 0) {
  const pct = Number(markupPct) || 0
  return (items || []).map(item => {
    const inHousePrice = Number(item._inHousePrice ?? item.price) || 0
    const nextPrice = pct > 0 ? Math.round(inHousePrice * (1 + pct / 100)) : inHousePrice
    return {
      ...item,
      _inHousePrice: inHousePrice,
      _markupPct: pct,
      price: nextPrice,
    }
  })
}

// Compute the online platform markup / commission embedded in an order.
// Returns { grossTotal, commission, netRevenue, markupPct, isOnline } so reports
// and order details can clearly separate Gross App Sales, Platform Commission (+20%),
// and Net Store Revenue (base in-house price).
export function computeOrderCommission(order, payMethods = []) {
  const grossTotal = Number(order?.total) || 0
  let rawItems = order?.items_snapshot || order?.items || []
  if (typeof rawItems === 'string') {
    try { rawItems = JSON.parse(rawItems || '[]') } catch { rawItems = [] }
  }
  const items = Array.isArray(rawItems) ? rawItems : []

  // 1. Exact item-level calculation when `_inHousePrice` was recorded on items
  let itemCommission = 0
  let hasItemMarkup = false
  let detectedPct = 0
  for (const it of items) {
    const qty = Number(it.qty) || 1
    const price = Number(it.price) || 0
    const base = Number(it._inHousePrice ?? price) || 0
    if (price > base && base > 0) {
      hasItemMarkup = true
      itemCommission += (price - base) * qty
      if (!detectedPct && it._markupPct) detectedPct = Number(it._markupPct)
    }
  }

  if (hasItemMarkup && itemCommission > 0) {
    const commission = Math.min(grossTotal, Math.round(itemCommission))
    const netRevenue = Math.max(0, grossTotal - commission)
    const markupPct = detectedPct || (netRevenue > 0 ? Math.round((commission / netRevenue) * 100) : 20)
    return { grossTotal, commission, netRevenue, markupPct, isOnline: true }
  }

  // 2. Fallback: infer from payment method or order_type (e.g., GoFood, GrabFood, ShopeeFood)
  const channel = order?.pay || order?.payment_method || order?.order_type || ''
  const pct = getMethodMarkupPct(channel, payMethods)
  if (pct > 0 && grossTotal > 0) {
    const netRevenue = Math.round(grossTotal / (1 + pct / 100))
    const commission = Math.max(0, grossTotal - netRevenue)
    return { grossTotal, commission, netRevenue, markupPct: pct, isOnline: true }
  }

  return { grossTotal, commission: 0, netRevenue: grossTotal, markupPct: 0, isOnline: false }
}

// Given an order row's own stored discount/subtotal, imply the discount % that
// produced it (discount is persisted as an absolute amount, not a rate) so it
// can be reapplied to a new subtotal — e.g. when merging two bills together.
export function impliedDiscountPct(order) {
  return order?.subtotal > 0 ? (order.discount || 0) / order.subtotal * 100 : 0
}

// Explode an order into its real per-method payment breakdown. `order.pay`
// is not reliable for aggregation — it's overwritten to the literal string
// 'Split' once a split bill finishes. The `payments` jsonb array (written
// for every Paid order, split or not) holds the true breakdown. Every
// payment-method aggregation site must use this instead of grouping on the
// raw `pay` column.
export function explodeOrderPayments(order) {
  let payments = order?.payments
  if (typeof payments === 'string') {
    try { payments = JSON.parse(payments || '[]') } catch { payments = [] }
  }
  if (Array.isArray(payments) && payments.length > 0) {
    return payments.map(p => ({ method: p.method || 'Other', amount: Number(p.amount) || 0 }))
  }
  return [{ method: order?.pay || 'Other', amount: Number(order?.total) || 0 }]
}
