-- Central units-of-measure list, replacing 4 separately hand-maintained hardcoded
-- arrays (InvIngredients.jsx, InvPO.jsx, MarketPrices.jsx, RecipeEditor.jsx) that had
-- already drifted out of sync with each other (different casing, missing items).
-- Shape: jsonb array of {id, name} objects, matching the existing `stations` column's
-- [{id,name,icon}] convention. Seeded client-side on first load of the new
-- Units of Measure settings page (matching how `stations`/`pos_behaviour` were never
-- SQL-seeded either — see Settings.jsx's DEFAULTS pattern).
alter table app_settings add column if not exists units jsonb default '[]'::jsonb;
