-- Additive, nullable. Safe to apply before the POS change ships.
alter table public.orders   add column if not exists commission_amount numeric;
alter table public.orders   add column if not exists expected_net      numeric;
alter table public.products add column if not exists platform_prices   jsonb;  -- e.g. {"GoFood":45000,"GrabFood":45000}
