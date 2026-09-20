-- ============================================================================
-- DOMAIN: FOUNDATION PERMISSIONS & DRIFT PREVENTION REMEDIATION
-- TARGET: Supabase PostgreSQL (production)
-- AUDIT REFERENCE: iStore Foundation Blocker Remediation
-- PRINCIPLES:
--   1. Grant full CRUD / ALL privileges to service_role ONLY (backend service access)
--   2. STRICTLY DO NOT grant backend access to anon or authenticated
--   3. Row Level Security (RLS) remains active and untouched
--   4. STRICTLY IGNORE ghost/legacy table (legacy_experimental_ledger_entries)
--   5. Configure default privileges to permanently eliminate permission drift
-- ============================================================================

-- 1. Ensure service_role can use public schema
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Active Runtime Tables - Grant full privileges to service_role ONLY

-- A. Pricing, Flash Sales & Promos (Pricing & Marketing domains)
GRANT ALL ON TABLE public.flash_sales TO service_role;
GRANT ALL ON TABLE public.price_histories TO service_role;
GRANT ALL ON TABLE public.pricing_rules TO service_role;
GRANT ALL ON TABLE public.promos TO service_role;

-- B. Provider Mappings (Provider integration & Catalog domains)
GRANT ALL ON TABLE public.provider_mappings TO service_role;

-- C. Inventory, Stocks & Quotas (Catalog & Inventory domains)
GRANT ALL ON TABLE public.stocks TO service_role;
GRANT ALL ON TABLE public.stock_movements TO service_role;
GRANT ALL ON TABLE public.quotas TO service_role;

-- D. Settlements & Reconciliation (Finance & Payout domains)
GRANT ALL ON TABLE public.settlement_batches TO service_role;
GRANT ALL ON TABLE public.settlement_records TO service_role;

-- 3. Ensure sequence usage for auto-generated columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. Prevent Future Permission Drift:
-- Set default privileges so any future tables or sequences created in public schema
-- automatically grant access to service_role without requiring manual one-off grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;
