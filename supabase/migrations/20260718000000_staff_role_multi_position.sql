-- staff.role changes from a single department string to a JSON array of
-- department names, so one staff member can belong to multiple stations
-- (e.g. Bakar + Kitchen) without editing app code. Existing single values are
-- preserved as one-element arrays. Guarded so it's safe to run more than once
-- (e.g. this file is applied directly rather than tracked via `supabase db push`).
do $$
begin
  if (select data_type from information_schema.columns
      where table_name = 'staff' and column_name = 'role') = 'jsonb' then
    return;
  end if;

  alter table staff alter column role drop default;
  alter table staff
    alter column role type jsonb
    using case when role is null or role = '' then '[]'::jsonb else jsonb_build_array(role) end;
  alter table staff alter column role set default '[]'::jsonb;
end $$;
