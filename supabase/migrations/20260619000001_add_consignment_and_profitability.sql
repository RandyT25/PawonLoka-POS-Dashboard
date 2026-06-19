-- Add is_consignment flag to products (replaces category-based detection)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_consignment BOOLEAN DEFAULT FALSE;

-- Create profitability settings table
CREATE TABLE IF NOT EXISTS profitability_settings (
  id          TEXT PRIMARY KEY DEFAULT 'main',
  target_food_cost NUMERIC(5,2) DEFAULT 35,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
