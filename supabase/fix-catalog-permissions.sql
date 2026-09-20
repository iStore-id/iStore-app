-- ============================================================================
-- DOMAIN: CATALOG PERMISSIONS REMEDIATION
-- TARGET: Supabase PostgreSQL (production)
-- AUDIT REFERENCE: iStore Catalog Permission Blocker
-- PRINCIPLES:
--   1. Grant full CRUD / ALL privileges to service_role ONLY (backend service access)
--   2. STRICTLY DO NOT grant backend access to anon or authenticated
--   3. Row Level Security (RLS) remains active and untouched
-- ============================================================================

-- 1. Ensure service_role can use public schema
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Catalog Tables - Grant full privileges to service_role
GRANT ALL ON TABLE public.categories TO service_role;
GRANT ALL ON TABLE public.games TO service_role;
GRANT ALL ON TABLE public.products TO service_role;
GRANT ALL ON TABLE public.product_variants TO service_role;
GRANT ALL ON TABLE public.game_categories TO service_role;

-- 3. Ensure sequence usage for any auto-generated columns (if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
