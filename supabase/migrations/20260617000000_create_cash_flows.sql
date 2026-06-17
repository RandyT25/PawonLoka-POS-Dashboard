create table if not exists public.cash_flows (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('income', 'expense')),
  amount      numeric(12, 2) not null default 0,
  description text,
  category    text,
  reference   text,          -- e.g. order_id or receipt number
  created_by  text,          -- staff name or "system"
  created_at  timestamptz not null default now()
);

alter table public.cash_flows enable row level security;

create policy "anon can read cash_flows"
  on public.cash_flows for select
  using (true);

create policy "anon can insert cash_flows"
  on public.cash_flows for insert
  with check (true);

create policy "anon can update cash_flows"
  on public.cash_flows for update
  using (true);

create policy "anon can delete cash_flows"
  on public.cash_flows for delete
  using (true);

create index cash_flows_type_created_at on public.cash_flows (type, created_at desc);
