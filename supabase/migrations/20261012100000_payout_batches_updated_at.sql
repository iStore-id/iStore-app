-- Additive compatibility fix for payout repository and payout RPCs.
-- The production table already exists; preserve all rows and existing constraints.
ALTER TABLE public.payout_batches
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
