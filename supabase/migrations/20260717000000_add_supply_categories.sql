-- Central supply-category list, replacing the hardcoded SUPPLY_CATEGORIES array in
-- ingredientCategories.js, so categories can be added/edited/deleted from a settings
-- page instead of a code change (same pattern as the units-of-measure column added
-- 2026-07-14). Shape: jsonb array of {id, name} objects.
alter table app_settings add column if not exists supply_categories jsonb default '[]'::jsonb;
