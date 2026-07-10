export const FOOD_CATEGORIES = ["Semi-finished","Poultry","Meat","Seafood","Vegetables","Fruits","Spices & Herbs","Dry Goods","Sauce","Beverages","Dairy","Bakery","General"]
export const SUPPLY_CATEGORIES = ["Packaging","Disposables","Trash & Vacuum Bags","Cleaning & Sanitation","Kitchen Tools & Utensils","Office & Stationery","Other Supplies"]

const CATEGORY_BUCKET = Object.fromEntries([
  ...FOOD_CATEGORIES.map(c => [c, "ingredient"]),
  ...SUPPLY_CATEGORIES.map(c => [c, "supply"]),
])

export function isSupplyCategory(cat) { return CATEGORY_BUCKET[cat] === "supply" }
export function isFoodCategory(cat) { return !isSupplyCategory(cat) }

export const ALL_CATEGORIES = [...FOOD_CATEGORIES, ...SUPPLY_CATEGORIES]
