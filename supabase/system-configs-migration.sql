-- Migration: Create system_configs table
-- Date: 2026-09-10

CREATE TABLE IF NOT EXISTS public.system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_configs_key ON public.system_configs(key);

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny public and anon access to system_configs" ON public.system_configs;
CREATE POLICY "Deny public and anon access to system_configs" ON public.system_configs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Allow service_role full access to system_configs" ON public.system_configs;
CREATE POLICY "Allow service_role full access to system_configs" ON public.system_configs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
