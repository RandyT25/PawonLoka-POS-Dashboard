alter table app_settings add column if not exists cat_routing jsonb default '{}'::jsonb;
