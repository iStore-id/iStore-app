-- Additive schema alignment for the existing refund and settlement repositories.
-- This migration preserves existing settlement columns and UUID primary keys.
-- It does not alter or rewrite existing financial rows.

CREATE TABLE IF NOT EXISTS public.refunds (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  refund_key VARCHAR(255) NOT NULL UNIQUE,
  amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PROCESSING',
  provider VARCHAR(50),
  provider_refund_id VARCHAR(255),
  requested_by VARCHAR(255),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access to refunds" ON public.refunds;
CREATE POLICY "Deny all access to refunds"
  ON public.refunds FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Allow service_role full access to refunds" ON public.refunds;
CREATE POLICY "Allow service_role full access to refunds"
  ON public.refunds FOR ALL TO service_role
  USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE public.refunds FROM anon, authenticated, public;
GRANT ALL ON TABLE public.refunds TO service_role;

-- Keep the existing UUID keys and canonical columns; add repository metadata.
ALTER TABLE public.settlement_batches
  ADD COLUMN IF NOT EXISTS period_date DATE,
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end DATE,
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS source_file_name TEXT,
  ADD COLUMN IF NOT EXISTS source_file_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mdr_fee_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_settled_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reference_id TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS processed_by VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_batches_source_file_hash
  ON public.settlement_batches(source_file_hash)
  WHERE source_file_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_batches_idempotency_key
  ON public.settlement_batches(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.settlement_records
  ADD COLUMN IF NOT EXISTS mdr_fee_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS gateway_transaction_status VARCHAR(80),
  ADD COLUMN IF NOT EXISTS gateway_settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_row_hash VARCHAR(32),
  ADD COLUMN IF NOT EXISTS provider_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS amount NUMERIC(20, 2),
  ADD COLUMN IF NOT EXISTS fee NUMERIC(20, 2) NOT NULL DEFAULT 0;

GRANT ALL ON TABLE public.refunds TO service_role;
GRANT ALL ON TABLE public.settlement_batches TO service_role;
GRANT ALL ON TABLE public.settlement_records TO service_role;
