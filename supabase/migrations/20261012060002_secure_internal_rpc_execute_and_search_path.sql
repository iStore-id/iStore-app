-- Restrict internal operational RPCs to the server-side service role.
-- Pin search_path to avoid object-shadowing attacks in functions with unqualified references.
-- Keep is_admin_or_owner executable by authenticated users because existing RLS policies call it.

ALTER FUNCTION public.atomic_consume_flash_sale_quota(uuid, uuid, text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.atomic_increment_promo_usage(uuid, uuid, text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.atomic_release_flash_sale_quota(text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.atomic_release_promo_usage(text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.atomic_reserve_stock(text, character varying, integer)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.claim_next_job(text, integer)
  SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.atomic_consume_flash_sale_quota(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_consume_flash_sale_quota(uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_increment_promo_usage(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_increment_promo_usage(uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_release_flash_sale_quota(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_release_flash_sale_quota(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_release_promo_usage(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_release_promo_usage(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_reserve_stock(text, character varying, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_reserve_stock(text, character varying, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_next_job(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_job(text, integer) TO service_role;

-- This SECURITY DEFINER helper is required by existing RLS policies for signed-in users.
-- Remove anonymous/public access but retain authenticated execution for policy evaluation.
ALTER FUNCTION public.is_admin_or_owner()
  SET search_path = pg_catalog, public, auth, pg_temp;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner() TO authenticated, service_role;

-- Trigger/event-trigger functions are not public RPC endpoints.
ALTER FUNCTION public.prevent_profile_privilege_escalation()
  SET search_path = pg_catalog, public, auth, pg_temp;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.rls_auto_enable()
  SET search_path = pg_catalog;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated, service_role;
