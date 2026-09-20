-- ============================================================================
-- DOMAIN: LOYALTY & REWARDS SYSTEM
-- MIGRATION: Firestore (loyaltyConfigs, pointTransactions) -> Supabase PostgreSQL
-- IDEMPOTENT: Safe to run multiple times
-- NO MUTATION / NO SEED / RLS PROTECTED
-- ============================================================================

-- 1. LOYALTY CONFIGURATION TABLE (Single Active Configuration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_configs (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'main',
    earn_rate_rp NUMERIC NOT NULL DEFAULT 10000 CHECK (earn_rate_rp >= 1),
    redeem_rate_idr NUMERIC NOT NULL DEFAULT 100 CHECK (redeem_rate_idr >= 1),
    min_redeem_points INTEGER NOT NULL DEFAULT 10 CHECK (min_redeem_points >= 0),
    max_redemption_percent NUMERIC NOT NULL DEFAULT 50 CHECK (max_redemption_percent >= 0 AND max_redemption_percent <= 100),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_loyalty_configs_single_row CHECK (id = 'main')
);

-- 2. POINT TRANSACTIONS LEDGER (Append-Only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('EARN', 'REDEEM', 'REFUND_REVERSAL', 'ADMIN_ADJUSTMENT', 'REFERRAL_EARN')),
    points INTEGER NOT NULL,
    reference VARCHAR(255) NOT NULL UNIQUE,
    order_id VARCHAR(100) REFERENCES public.orders(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(100) NOT NULL DEFAULT 'system'
);

-- 3. INDEXES FOR PERFORMANCE & IDEMPOTENCY
-- ----------------------------------------------------------------------------
-- Index for customer balance calculation and lookup: SUM(points) WHERE customer_id = ...
CREATE INDEX IF NOT EXISTS idx_point_transactions_customer_id ON public.point_transactions(customer_id);

-- Index for customer transaction history (sorted by createdAt descending)
CREATE INDEX IF NOT EXISTS idx_point_transactions_customer_created ON public.point_transactions(customer_id, created_at DESC);

-- Index for admin recent transactions query (sorted by createdAt descending)
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON public.point_transactions(created_at DESC);

-- Unique index on reference for idempotency guarantee
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_reference ON public.point_transactions(reference);

-- Index on order_id for order-associated lookups (reversals, order detail)
CREATE INDEX IF NOT EXISTS idx_point_transactions_order_id ON public.point_transactions(order_id) WHERE order_id IS NOT NULL;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.loyalty_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Deny public and anon access to loyalty_configs
DROP POLICY IF EXISTS "Deny public and anon access to loyalty_configs" ON public.loyalty_configs;
CREATE POLICY "Deny public and anon access to loyalty_configs" ON public.loyalty_configs
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- Allow service_role full access to loyalty_configs
DROP POLICY IF EXISTS "Allow service_role full access to loyalty_configs" ON public.loyalty_configs;
CREATE POLICY "Allow service_role full access to loyalty_configs" ON public.loyalty_configs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Deny public and anon access to point_transactions
DROP POLICY IF EXISTS "Deny public and anon access to point_transactions" ON public.point_transactions;
CREATE POLICY "Deny public and anon access to point_transactions" ON public.point_transactions
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- Allow service_role full access to point_transactions
DROP POLICY IF EXISTS "Allow service_role full access to point_transactions" ON public.point_transactions;
CREATE POLICY "Allow service_role full access to point_transactions" ON public.point_transactions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. PERMISSIONS
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE public.loyalty_configs TO service_role;
GRANT ALL ON TABLE public.point_transactions TO service_role;
