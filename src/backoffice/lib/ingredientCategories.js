export const FOOD_CATEGORIES = ["Semi-finished","Poultry","Meat","Seafood","Vegetables","Fruits","Spices & Herbs","Dry Goods","Sauce","Beverages","Dairy","Bakery","General"]
export const SUPPLY_CATEGORIES_FALLBACK = ["Packaging","Disposables","Trash & Vacuum Bags","Cleaning & Sanitation","Kitchen Tools & Utensils","Office & Stationery","Charcoal","Other Supplies"]

// Mutable at runtime — Backoffice.jsx fetches app_settings.supply_categories once on
// mount and calls setSupplyCategories() so any category added/renamed/deleted via the
// Supply Categories settings page is reflected everywhere isSupplyCategory/isFoodCategory
// are used (Dashboard, InvOverview, RecipeEditor, InvIngredients), not just the picklist.
let supplyCategories = SUPPLY_CATEGORIES_FALLBACK
let CATEGORY_BUCKET = buildBucket(supplyCategories)

function buildBucket(supplyCats) {
  return Object.fromEntries([
    ...FOOD_CATEGORIES.map(c => [c, "ingredient"]),
    ...supplyCats.map(c => [c, "supply"]),
  ])
}

export function setSupplyCategories(names) {
  if (!names || !names.length) return
  supplyCategories = names
  CATEGORY_BUCKET = buildBucket(supplyCategories)
}

export function getSupplyCategories() { return supplyCategories }

export function isSupplyCategory(cat) { return CATEGORY_BUCKET[cat] === "supply" }
export function isFoodCategory(cat) { return !isSupplyCategory(cat) }

export const ALL_CATEGORIES = [...FOOD_CATEGORIES, ...SUPPLY_CATEGORIES_FALLBACK]
