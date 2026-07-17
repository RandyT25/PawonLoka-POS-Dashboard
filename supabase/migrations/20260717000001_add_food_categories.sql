-- Central ingredient-category list, replacing the hardcoded FOOD_CATEGORIES array in
-- ingredientCategories.js — same treatment as supply_categories (2026-07-17) and
-- units (2026-07-14), now combined into one "Categories" settings page with tabs
-- for Ingredients vs Supplies. Shape: jsonb array of {id, name} objects.
alter table app_settings add column if not exists food_categories jsonb default '[]'::jsonb;
