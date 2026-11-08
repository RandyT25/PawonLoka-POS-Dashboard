-- PHASE 1b, STEP 1 of 2 — ADDITIVE ONLY. Safe to apply while old clients are still in use.
-- DO NOT AUTO-RUN. Review, then paste into the Supabase SQL editor.
-- Adds: pin_hash (bcrypt backfill), lockout table, verify/set PIN RPCs, staff admin RPCs.
-- Does NOT revoke anything and does NOT touch staff.pin (old clients keep working).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.staff add column if not exists pin_hash text;
update public.staff
set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf', 10))
where pin is not null and pin_hash is null;

create table if not exists private.auth_attempts (
  key text primary key, fails int not null default 0, locked_until timestamptz
);
create table if not exists private.secrets (key text primary key, value text not null);

-- ---------- PIN policy ----------
-- 6 digits for Owner/Manager (and the manager PIN); 4 digits for everyone else.
-- Rejects all-same (1111), straight runs (1234, 4321, 123456), and repeated pairs/triples (1212, 123123).
create or replace function private.pin_ok(p_pin text, p_six boolean) returns boolean
language sql immutable as $$
  select p_pin ~ (case when p_six then '^\d{6}$' else '^\d{4}$' end)
     and p_pin !~ '^(\d)\1+$'
     and position(p_pin in '01234567890') = 0
     and position(p_pin in '09876543210') = 0
     and not (length(p_pin) = 4 and substr(p_pin,1,2) = substr(p_pin,3,2))
     and not (length(p_pin) = 6 and (substr(p_pin,1,3) = substr(p_pin,4,3) or p_pin ~ '^(\d\d)\1\1$'));
$$;

create or replace function private.is_priv(p_roles jsonb) returns boolean
language sql immutable as $$ select coalesce(p_roles ? 'Owner' or p_roles ? 'Manager', false) $$;

-- ---------- lockout: 5 wrong attempts -> 5 minutes ----------
create or replace function private.lock_state(p_key text) returns int   -- seconds left, 0 = open
language sql stable as $$
  select coalesce(greatest(0, ceil(extract(epoch from (locked_until - now())))::int), 0)
  from private.auth_attempts where key = p_key
$$;
create or replace function private.record_fail(p_key text) returns void language sql as $$
  insert into private.auth_attempts(key, fails) values (p_key, 1)
  on conflict (key) do update set
    fails = case when private.auth_attempts.locked_until is not null and private.auth_attempts.locked_until <= now() then 1 else private.auth_attempts.fails + 1 end,
    locked_until = case when (case when private.auth_attempts.locked_until is not null and private.auth_attempts.locked_until <= now() then 1 else private.auth_attempts.fails + 1 end) >= 5
                        then now() + interval '5 minutes' else null end
$$;
create or replace function private.record_ok(p_key text) returns void language sql as $$
  delete from private.auth_attempts where key = p_key
$$;

-- Internal: authenticate a staff member by name+PIN. Returns the staff row or null; honours lockout.
-- (Returns jsonb so a failure still persists its counter — raising would roll it back.)
create or replace function private.auth_staff(p_name text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s public.staff; k text := 'staff:' || lower(coalesce(p_name,'')); left_s int;
begin
  left_s := private.lock_state(k);
  if left_s > 0 then return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_after', left_s); end if;
  select * into s from public.staff where lower(name) = lower(p_name) and active is true;
  if found and s.pin_hash is not null and s.pin_hash = crypt(coalesce(p_pin,''), s.pin_hash) then
    perform private.record_ok(k);
    return jsonb_build_object('ok', true, 'staff', jsonb_build_object(
      'id', s.id, 'name', s.name, 'role', to_jsonb(s.role), 'color', s.color, 'permissions', s.permissions));
  end if;
  if found then perform private.record_fail(k); end if;   -- unknown names are not tracked (no table growth)
  return jsonb_build_object('ok', false, 'reason', 'invalid');
end $$;

-- ---------- public RPCs ----------
create or replace function public.verify_pin(p_name text, p_pin text) returns jsonb
language sql security definer set search_path = public, extensions, pg_temp as $$
  select private.auth_staff(p_name, p_pin)
$$;

create or replace function public.verify_manager_pin(p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text; left_s int;
begin
  left_s := private.lock_state('manager');
  if left_s > 0 then return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_after', left_s); end if;
  select value into h from private.secrets where key = 'manager_pin_hash';
  if h is null then return jsonb_build_object('ok', false, 'reason', 'not_configured'); end if;  -- void/refund blocked
  if h = crypt(coalesce(p_pin,''), h) then perform private.record_ok('manager'); return jsonb_build_object('ok', true); end if;
  perform private.record_fail('manager');
  return jsonb_build_object('ok', false, 'reason', 'invalid');
end $$;

-- Whether a manager PIN is configured (so the UI can say "set one in Backoffice" instead of "wrong PIN").
create or replace function public.manager_pin_configured() returns boolean
language sql security definer set search_path = public, pg_temp as $$
  select exists(select 1 from private.secrets where key = 'manager_pin_hash')
$$;

-- Owner-only actions: caller proves identity with their own name+PIN.
create or replace function private.require_owner(p_name text, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare a jsonb := private.auth_staff(p_name, p_pin);
begin
  if not (a->>'ok')::boolean then raise exception 'auth_failed:%', coalesce(a->>'reason','invalid'); end if;
  if not (a->'staff'->'role') ? 'Owner' then raise exception 'not_owner'; end if;
end $$;

create or replace function public.set_manager_pin(p_actor text, p_actor_pin text, p_new_pin text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform private.require_owner(p_actor, p_actor_pin);
  if not private.pin_ok(p_new_pin, true) then raise exception 'weak_pin'; end if;
  insert into private.secrets(key, value) values ('manager_pin_hash', crypt(p_new_pin, gen_salt('bf', 10)))
  on conflict (key) do update set value = excluded.value;
  perform private.record_ok('manager');
end $$;

-- Owner-only staff admin (replaces direct anon writes/reads once step 2 is applied).
create or replace function public.staff_admin_list(p_actor text, p_actor_pin text) returns setof jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform private.require_owner(p_actor, p_actor_pin);
  return query select to_jsonb(s) - 'pin' - 'pin_hash' from public.staff s order by s.name;
end $$;

-- p_staff: {id?, name, role[], color, active, permissions, salary, phone, join_date, pin?}
create or replace function public.staff_admin_save(p_actor text, p_actor_pin text, p_staff jsonb) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare sid text := nullif(p_staff->>'id',''); v_pin text := nullif(p_staff->>'pin',''); six boolean;
begin
  perform private.require_owner(p_actor, p_actor_pin);
  six := private.is_priv(p_staff->'role');
  if v_pin is not null and not private.pin_ok(v_pin, six) then raise exception 'weak_pin'; end if;
  if sid is null then
    if v_pin is null then raise exception 'pin_required'; end if;
    sid := 'STAFF-' || (extract(epoch from clock_timestamp()) * 1000)::bigint;
    insert into public.staff(id, name, role, color, active, permissions, salary, phone, join_date, pin, pin_hash)
    values (sid, p_staff->>'name', p_staff->'role', p_staff->>'color', coalesce((p_staff->>'active')::boolean, true),
            p_staff->'permissions', (p_staff->>'salary')::numeric, p_staff->'phone', p_staff->'join_date',
            null, crypt(v_pin, gen_salt('bf', 10)));
  else
    update public.staff set
      name = coalesce(p_staff->>'name', name), role = coalesce(p_staff->'role', to_jsonb(role)),
      color = coalesce(p_staff->>'color', color), active = coalesce((p_staff->>'active')::boolean, active),
      permissions = coalesce(p_staff->'permissions', permissions),
      salary = coalesce((p_staff->>'salary')::numeric, salary),
      phone = coalesce(p_staff->'phone', phone), join_date = coalesce(p_staff->'join_date', join_date),
      pin_hash = case when v_pin is null then pin_hash else crypt(v_pin, gen_salt('bf', 10)) end,
      pin = case when v_pin is null then public.staff.pin else null end   -- stop keeping plaintext once re-set
    where id = sid;
    if v_pin is not null then perform private.record_ok('staff:' || lower(p_staff->>'name')); end if;
  end if;
  return sid;
end $$;

create or replace function public.staff_admin_delete(p_actor text, p_actor_pin text, p_id text) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform private.require_owner(p_actor, p_actor_pin);
  delete from public.staff where id = p_id;
end $$;

revoke all on function public.verify_pin(text,text), public.verify_manager_pin(text), public.manager_pin_configured(),
  public.set_manager_pin(text,text,text), public.staff_admin_list(text,text),
  public.staff_admin_save(text,text,jsonb), public.staff_admin_delete(text,text,text) from public;
grant execute on function public.verify_pin(text,text), public.verify_manager_pin(text), public.manager_pin_configured(),
  public.set_manager_pin(text,text,text), public.staff_admin_list(text,text),
  public.staff_admin_save(text,text,jsonb), public.staff_admin_delete(text,text,text) to anon, authenticated;

-- NOTE: no manager PIN is seeded. Until the Owner calls set_manager_pin (Backoffice -> Settings),
-- void/refund stay blocked ('not_configured'). Existing app_settings.pos_behaviour.manager_pin ('9999'?) is NOT migrated.
-- NOTE: existing 4-digit Owner PIN keeps working for login until changed; staff_admin_save enforces 6 digits on the next save.
