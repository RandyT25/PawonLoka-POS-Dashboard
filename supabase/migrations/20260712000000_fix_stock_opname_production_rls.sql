-- stock_opname and production_batches were rejecting every insert with a
-- row-level-security violation (confirmed live: 42501 "new row violates
-- row-level security policy"), so approved staff stock-counts/production
-- batches were silently never appearing in Inventory > Stock Opname /
-- Production, even though the submission itself was marked "approved".
-- Match the same blanket allow-all policy convention used elsewhere
-- (see 20260705000001_create_assets.sql) since this app has no per-user auth.

alter table public.stock_opname enable row level security;
drop policy if exists "anon can read stock_opname" on public.stock_opname;
drop policy if exists "anon can insert stock_opname" on public.stock_opname;
drop policy if exists "anon can update stock_opname" on public.stock_opname;
drop policy if exists "anon can delete stock_opname" on public.stock_opname;
create policy "anon can read stock_opname"   on public.stock_opname for select using (true);
create policy "anon can insert stock_opname" on public.stock_opname for insert with check (true);
create policy "anon can update stock_opname" on public.stock_opname for update using (true);
create policy "anon can delete stock_opname" on public.stock_opname for delete using (true);

alter table public.production_batches enable row level security;
drop policy if exists "anon can read production_batches" on public.production_batches;
drop policy if exists "anon can insert production_batches" on public.production_batches;
drop policy if exists "anon can update production_batches" on public.production_batches;
drop policy if exists "anon can delete production_batches" on public.production_batches;
create policy "anon can read production_batches"   on public.production_batches for select using (true);
create policy "anon can insert production_batches" on public.production_batches for insert with check (true);
create policy "anon can update production_batches" on public.production_batches for update using (true);
create policy "anon can delete production_batches" on public.production_batches for delete using (true);
