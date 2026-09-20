-- Migration: Catalog Tables (providers, provider_skus)
-- Objective: Unblock Phase 6C by providing necessary catalog schema.

CREATE TABLE IF NOT EXISTS public.providers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.provider_skus (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES public.providers(id),
  sku_code TEXT NOT NULL,
  name TEXT NOT NULL,
  metadata JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, sku_code)
);

CREATE INDEX IF NOT EXISTS idx_provider_skus_provider_id ON public.provider_skus(provider_id);
