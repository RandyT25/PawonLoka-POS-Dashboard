-- PHASE 1b, STEP 2 of 2 — BREAKING for old clients. Apply ONLY after:
--   (a) security_01 is applied, (b) the new web build is deployed, (c) the new APK is installed on every tablet.
-- Old clients select staff.pin / write staff directly and will fail after this runs.
-- DO NOT AUTO-RUN.

-- 1. Anon can no longer read pin / pin_hash / salary, nor write staff directly.
revoke select, insert, update, delete on public.staff from anon, authenticated;
grant select (id, name, role, color, active, created_at, permissions, phone, join_date) on public.staff to anon, authenticated;

-- 2. Drop plaintext PINs (after confirming every active staff row has pin_hash):
--    select name from public.staff where active and pin_hash is null;   -- must return 0 rows
update public.staff set pin = null where pin_hash is not null;

-- 3. Remove manager PIN from the world-readable settings row.
update public.app_settings set pos_behaviour = pos_behaviour - 'manager_pin' where id = 'main';

-- 4. Retired bot objects that still grant access are handled in Phase 3 (DROP migration), not here.
