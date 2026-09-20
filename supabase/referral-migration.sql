-- ============================================================================
-- DOMAIN: REFERRAL SYSTEM MIGRATION
-- DESCRIPTION: Schema, Foreign Keys, Constraints, Indexes and Security for Referral Service
-- TARGET: Supabase (PostgreSQL)
-- ============================================================================

-- 1. Extend public.profiles Table if columns do not exist
-- Add referral_code column to profile (Allows NULL for multiple users, but must be unique if set)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code VARCHAR(255);

-- Add referred_by column to profile referencing another profile (safe ON DELETE SET NULL to preserve history)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create unique index on referral_code where it is not null (allows multiple NULLs but strictly unique alphanumeric codes)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_uidx ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;


-- 2. Create Referral Relationships Table
-- Maintains deterministic ID mapping as a string (REF_${referrerUid}_${referredUid})
CREATE TABLE IF NOT EXISTS public.referral_relationships (
    id VARCHAR(255) PRIMARY KEY,
    referrer_uid UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    referred_uid UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONVERTED', 'EXPIRED')),
    referral_code VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'MANUAL_INPUT' CHECK (source IN ('URL', 'MANUAL_INPUT', 'API')),
    qualified_order_id VARCHAR(255),
    reward_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (reward_status IN ('PENDING', 'GRANTED', 'CANCELLED', 'REVERSED')),
    reward_type VARCHAR(50) NOT NULL DEFAULT 'NONE' CHECK (reward_type IN ('POINTS', 'COMMISSION', 'BOTH', 'NONE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    converted_at TIMESTAMPTZ,
    metadata JSONB,
    -- Prevent self-referrals at the db level
    CONSTRAINT check_no_self_referral CHECK (referrer_uid <> referred_uid)
);


-- 3. Optimization Indexes & Integrity Constraints

-- A. Lookup and index by referrer_uid (for getting stats and lists of referred users)
CREATE INDEX IF NOT EXISTS referral_relationships_referrer_uid_idx ON public.referral_relationships(referrer_uid);

-- B. First-Referrer-Wins Constraint (One referred customer can only ever be attributed to ONE referral relationship)
-- This enforces unique mapping for referred_uid globally across all relationships
CREATE UNIQUE INDEX IF NOT EXISTS referral_relationships_referred_uid_uidx ON public.referral_relationships(referred_uid);

-- C. Lookup by qualified_order_id (for fast reversal/refund tracing)
CREATE INDEX IF NOT EXISTS referral_relationships_qualified_order_id_idx ON public.referral_relationships(qualified_order_id);

-- D. Composite index for filtering and state lists in Admin panel
CREATE INDEX IF NOT EXISTS referral_relationships_status_reward_status_idx ON public.referral_relationships(status, reward_status);


-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.referral_relationships ENABLE ROW LEVEL SECURITY;


-- 5. Access Control / Grants (Project standard security)
-- Revoke all direct table privileges from public and anon roles
REVOKE ALL ON public.referral_relationships FROM anon, authenticated, public;

-- Grant secure access exclusively to the service_role for backend operations
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_relationships TO service_role;
