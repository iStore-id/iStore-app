-- Migration: Reconstructed from Production Schema.
-- Purpose: Create jobs queue table.

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
  priority VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reference_id VARCHAR(255),
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS and setup permissions
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.jobs TO service_role;
REVOKE ALL ON TABLE public.jobs FROM anon, authenticated, public;
