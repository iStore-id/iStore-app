-- ============================================================================
-- DOMAIN: CORE FOUNDATION & RECONCILIATION
-- REMEDIATION: Grant table-level privileges to service_role on core tables
-- TARGET: Supabase PostgreSQL (public schema)
-- STRICT CONSTRAINTS: 
--   - Does NOT alter schemas or drop/create tables
--   - Does NOT modify RLS policies
--   - Does NOT grant permissions to anon or authenticated
-- ============================================================================

-- 1. Ensure service_role can use public schema
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Core Tables - Grant full privileges to service_role
GRANT ALL ON TABLE public.roles TO service_role;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.orders TO service_role;
GRANT ALL ON TABLE public.audit_logs TO service_role;
GRANT ALL ON TABLE public.system_logs TO service_role;
GRANT ALL ON TABLE public.payment_gateways TO service_role;
GRANT ALL ON TABLE public.reconciliation_runs TO service_role;
GRANT ALL ON TABLE public.reconciliation_records TO service_role;

-- 3. Ensure sequence usage for auto-generated columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
