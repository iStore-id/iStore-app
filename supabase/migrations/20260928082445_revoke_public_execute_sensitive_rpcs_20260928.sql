-- Migration: Reconstructed from Production Schema.
-- Purpose: Revoke execution rights from public on administrative RPCs.

REVOKE EXECUTE ON FUNCTION public.post_ledger_journal(VARCHAR(255), VARCHAR(100), VARCHAR(100), VARCHAR(255), VARCHAR(10), NUMERIC(20, 2), UUID, JSONB, JSONB) FROM public, anon, authenticated;
