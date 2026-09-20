-- ============================================================================
-- REFUNDS DOMAIN MIGRATION & RLS
-- DESCRIPTION: Creates public.refunds table aligned with order references and RLS
-- TARGET: Supabase (PostgreSQL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.refunds (
    id VARCHAR(255) PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    refund_key VARCHAR(255) NOT NULL UNIQUE,
    amount NUMERIC(20, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSING',
    provider VARCHAR(50) DEFAULT 'midtrans',
    provider_refund_id VARCHAR(255),
    requested_by VARCHAR(255),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

-- Row Level Security (RLS)
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all access to refunds" ON public.refunds;
CREATE POLICY "Deny all access to refunds" ON public.refunds FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow service_role full access to refunds" ON public.refunds;
CREATE POLICY "Allow service_role full access to refunds" ON public.refunds FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.refunds FROM anon, authenticated, public;
GRANT ALL ON TABLE public.refunds TO service_role;
