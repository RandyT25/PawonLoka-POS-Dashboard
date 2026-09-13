ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS store_lat numeric;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS store_lng numeric;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS store_radius_meters integer DEFAULT 50;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_lat numeric;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_lng numeric;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_lat numeric;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_lng numeric;
