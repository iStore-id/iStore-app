-- Move the admin/owner authorization helper out of the exposed public schema.
-- Keep authenticated EXECUTE for RLS policy evaluation, but prevent direct public RPC exposure.
begin;

create schema if not exists private authorization postgres;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role_id in ('admin', 'pemilik')
  );
$function$;

revoke all on function private.is_admin_or_owner() from public, anon;
grant execute on function private.is_admin_or_owner() to authenticated, service_role;

do $migration$
declare
  pol record;
  using_expr text;
  check_expr text;
begin
  for pol in
    select p.polname, c.relname as table_name, n.nspname as schema_name,
           pg_get_expr(p.polqual, p.polrelid) as using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') ilike '%is_admin_or_owner()%'
        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ilike '%is_admin_or_owner()%'
      )
  loop
    using_expr := pol.using_expr;
    check_expr := pol.check_expr;

    if using_expr is not null then
      using_expr := replace(using_expr, 'is_admin_or_owner()', 'private.is_admin_or_owner()');
    end if;
    if check_expr is not null then
      check_expr := replace(check_expr, 'is_admin_or_owner()', 'private.is_admin_or_owner()');
    end if;

    if using_expr is not null and check_expr is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)',
        pol.polname, pol.schema_name, pol.table_name, using_expr, check_expr);
    elsif using_expr is not null then
      execute format('alter policy %I on %I.%I using (%s)',
        pol.polname, pol.schema_name, pol.table_name, using_expr);
    elsif check_expr is not null then
      execute format('alter policy %I on %I.%I with check (%s)',
        pol.polname, pol.schema_name, pol.table_name, check_expr);
    end if;
  end loop;
end;
$migration$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'pg_temp'
as $function$
begin
    if private.is_admin_or_owner() or (auth.jwt() ->> 'role' = 'service_role') then
        return new;
    end if;

    if new.role_id is distinct from old.role_id then
        raise exception 'Privilege escalation rejected: Customer cannot modify role_id';
    end if;

    if new.status is distinct from old.status then
        raise exception 'Privilege escalation rejected: Customer cannot modify account status';
    end if;

    if new.email is distinct from old.email then
        raise exception 'Privilege escalation rejected: Email must be updated through authenticated email verification flow';
    end if;

    if new.metadata is distinct from old.metadata then
        if new.metadata ? 'role' or new.metadata ? 'is_admin' or new.metadata ? 'permissions' or new.metadata ? 'owner' then
            raise exception 'Privilege escalation rejected: Customer cannot inject authorization keys into metadata';
        end if;
    end if;

    new.updated_at = now();
    return new;
end;
$function$;

revoke all on function public.is_admin_or_owner() from public, anon, authenticated;
drop function public.is_admin_or_owner();

commit;
