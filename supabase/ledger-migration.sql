-- ============================================================================
-- DOMAIN: RELATIONAL DOUBLE-ENTRY LEDGER FOUNDATION
-- MIGRATION: Phase 4E - Schema Implementation
-- TABLES: ledger_accounts, ledger_journals, ledger_entries, account_balances
-- IDEMPOTENT: Safe to run multiple times, no destructive operations
-- TARGET: Supabase (PostgreSQL)
-- ============================================================================

-- Extension check for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLE: ledger_accounts
-- Purpose: Chart of accounts for double-entry classification
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
    id VARCHAR(255) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ledger_accounts
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_code ON public.ledger_accounts(code);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_type ON public.ledger_accounts(type);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_is_active ON public.ledger_accounts(is_active);

-- ----------------------------------------------------------------------------
-- 2. TABLE: ledger_journals
-- Purpose: Header records for double-entry financial events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    source_type VARCHAR(100),
    source_id VARCHAR(255),
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    total_amount NUMERIC(20, 2) NOT NULL CHECK (total_amount > 0),
    reversal_of UUID REFERENCES public.ledger_journals(id) ON DELETE RESTRICT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ledger_journals
CREATE INDEX IF NOT EXISTS idx_ledger_journals_idempotency_key ON public.ledger_journals(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_ledger_journals_event_type ON public.ledger_journals(event_type);
CREATE INDEX IF NOT EXISTS idx_ledger_journals_source ON public.ledger_journals(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_journals_created_at ON public.ledger_journals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_journals_reversal_of ON public.ledger_journals(reversal_of);

-- ----------------------------------------------------------------------------
-- 3. TABLE: ledger_entries
-- Purpose: Balanced debit/credit line items per journal
-- Invariant: SUM(debit) = SUM(credit) enforced at transaction/posting boundary
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES public.ledger_journals(id) ON DELETE RESTRICT,
    account_id VARCHAR(255) NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ledger_entries_xor_amount CHECK (
        ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
    )
);

-- Indexes for ledger_entries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_journal_id ON public.ledger_entries(journal_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id ON public.ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON public.ledger_entries(created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. TABLE: account_balances
-- Purpose: Materialized balance projection for performance (non-authoritative cache)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    balance NUMERIC(20, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_account_balances_account_currency UNIQUE (account_id, currency)
);

-- Indexes for account_balances
CREATE INDEX IF NOT EXISTS idx_account_balances_account_id ON public.account_balances(account_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_currency ON public.account_balances(currency);

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) & PERMISSIONS
-- Ledger tables are strictly restricted to service_role (backend execution)
-- ----------------------------------------------------------------------------
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access (anon, authenticated)
DROP POLICY IF EXISTS "Deny all access to ledger_accounts" ON public.ledger_accounts;
CREATE POLICY "Deny all access to ledger_accounts" ON public.ledger_accounts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all access to ledger_journals" ON public.ledger_journals;
CREATE POLICY "Deny all access to ledger_journals" ON public.ledger_journals FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all access to ledger_entries" ON public.ledger_entries;
CREATE POLICY "Deny all access to ledger_entries" ON public.ledger_entries FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all access to account_balances" ON public.account_balances;
CREATE POLICY "Deny all access to account_balances" ON public.account_balances FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access to ledger_accounts" ON public.ledger_accounts;
CREATE POLICY "Allow service_role full access to ledger_accounts" ON public.ledger_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to ledger_journals" ON public.ledger_journals;
CREATE POLICY "Allow service_role full access to ledger_journals" ON public.ledger_journals FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to ledger_entries" ON public.ledger_entries;
CREATE POLICY "Allow service_role full access to ledger_entries" ON public.ledger_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to account_balances" ON public.account_balances;
CREATE POLICY "Allow service_role full access to account_balances" ON public.account_balances FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoke permissions from public/anon/authenticated and grant to service_role
REVOKE ALL ON TABLE public.ledger_accounts FROM anon, authenticated, public;
GRANT ALL ON TABLE public.ledger_accounts TO service_role;

REVOKE ALL ON TABLE public.ledger_journals FROM anon, authenticated, public;
GRANT ALL ON TABLE public.ledger_journals TO service_role;

REVOKE ALL ON TABLE public.ledger_entries FROM anon, authenticated, public;
GRANT ALL ON TABLE public.ledger_entries TO service_role;

REVOKE ALL ON TABLE public.account_balances FROM anon, authenticated, public;
GRANT ALL ON TABLE public.account_balances TO service_role;
