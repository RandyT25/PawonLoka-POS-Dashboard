-- Add kitchen_ticket JSONB column to app_settings
-- Used by the Kitchen Ticket Designer to store per-outlet ticket layout settings
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS kitchen_ticket JSONB DEFAULT NULL;
