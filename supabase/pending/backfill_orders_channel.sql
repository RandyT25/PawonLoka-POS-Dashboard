-- DO NOT AUTO-RUN. Review, then run step 1, then step 2 manually in the Supabase SQL editor.
-- POS never set orders.channel, so online orders were saved with the default 'dine_in'.

-- Step 1: row count (and breakdown) that step 2 would touch
select lower(pay) as new_channel, count(*) as rows
from public.orders
where channel = 'dine_in' and pay in ('GoFood','GrabFood','ShopeeFood')
group by 1;

-- Step 2: backfill inside a transaction; check the reported count, then commit
begin;
update public.orders
set channel = lower(pay)
where channel = 'dine_in' and pay in ('GoFood','GrabFood','ShopeeFood');
-- expect the same total as step 1, then:  commit;   (or rollback;)
