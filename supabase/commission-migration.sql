-- ============================================================================
-- DOMAIN: COMMISSION & AFFILIATE REWARDS SYSTEM
-- MIGRATION: Firestore (commissionRecipients, commissionRules, commissionRecords) -> Supabase PostgreSQL
-- ARCHITECTURAL STAGE: Commission Relational Schema Foundation
-- IDEMPOTENT: Safe to run multiple times across clean and existing databases
-- NON-DESTRUCTIVE: Preserves existing tables and legacy columns
-- NO MUTATION / NO SEED DATA / STRICT RLS PROTECTED
-- LEDGER INTEGRATION COMPATIBILITY (CoA Phase 4I):
--   - Account 2000: Commission Payable (LIABILITY, CREDIT)
--   - Account 2100: Settlement Clearing (LIABILITY, CREDIT)
--   - Account 5000: Commission Expense (EXPENSE, DEBIT)
--   - ledger_journal_id is a loose bridge (VARCHAR(255)) without a database FK
--   - payout_batch_id is loose-coupled (VARCHAR(255)) without a database FK
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BASE TABLE CREATION (Ordered by Referential Dependency)
-- ----------------------------------------------------------------------------

-- 1.1 COMMISSION RECIPIENTS TABLE (Independent entity, optional user profile link)
CREATE TABLE IF NOT EXISTS public.commission_recipients (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'AFFILIATE',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    payout_bank_name VARCHAR(100),
    payout_account_number_masked VARCHAR(100),
    payout_account_holder_name VARCHAR(255),
    payout_account_number_encrypted TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system',
    CONSTRAINT uq_commission_recipients_code UNIQUE (code),
    CONSTRAINT chk_commission_recipients_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
    CONSTRAINT fk_commission_recipients_user_id FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 1.2 COMMISSION RULES TABLE (Depends on commission_recipients)
CREATE TABLE IF NOT EXISTS public.commission_rules (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    recipient_type VARCHAR(50) NOT NULL DEFAULT 'AFFILIATE',
    recipient_id VARCHAR(255),
    game_id VARCHAR(255),
    product_id VARCHAR(255),
    variant_id VARCHAR(255),
    calculation_method VARCHAR(100) NOT NULL,
    rate NUMERIC(20, 2) NOT NULL,
    min_order_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
    max_commission_amount NUMERIC(20, 2),
    priority INTEGER NOT NULL DEFAULT 10,
    effective_from DATE NOT NULL,
    effective_until DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system',
    CONSTRAINT fk_commission_rules_recipient_id FOREIGN KEY (recipient_id) REFERENCES public.commission_recipients(id) ON DELETE SET NULL,
    CONSTRAINT chk_commission_rules_calc_method CHECK (calculation_method IN ('PERCENTAGE_OF_SELLING_PRICE', 'FIXED_AMOUNT', 'PERCENTAGE_OF_MARGIN')),
    CONSTRAINT chk_commission_rules_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- 1.3 COMMISSION RECORDS TABLE (Depends on orders, recipients, rules)
CREATE TABLE IF NOT EXISTS public.commission_records (
    id VARCHAR(255) PRIMARY KEY, -- Deterministic ID: comm_order_${orderId}_${recipientId}
    order_id VARCHAR(255) NOT NULL,
    recipient_id VARCHAR(255) NOT NULL,
    recipient_code VARCHAR(50) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    recipient_type VARCHAR(50) NOT NULL DEFAULT 'AFFILIATE',
    rule_id VARCHAR(255) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    calculation_method VARCHAR(100) NOT NULL,
    selling_price_snapshot NUMERIC(20, 2) NOT NULL,
    base_cost_snapshot NUMERIC(20, 2),
    commission_rate_snapshot NUMERIC(10, 2) NOT NULL,
    fixed_amount_snapshot NUMERIC(20, 2) NOT NULL,
    commission_amount INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    status VARCHAR(50) NOT NULL DEFAULT 'PAYABLE',
    cumulative_reversed_amount INTEGER NOT NULL DEFAULT 0,
    remaining_payable_amount INTEGER NOT NULL DEFAULT 0,
    cancel_reason VARCHAR(255),
    reversal_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb,
    payout_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
    payout_batch_id VARCHAR(255),
    paid_at TIMESTAMPTZ,
    ledger_status VARCHAR(50) DEFAULT 'PENDING',
    ledger_journal_id VARCHAR(255),
    ledger_posted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reversed_at TIMESTAMPTZ,
    CONSTRAINT fk_commission_records_order_id FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_commission_records_recipient_id FOREIGN KEY (recipient_id) REFERENCES public.commission_recipients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_commission_records_rule_id FOREIGN KEY (rule_id) REFERENCES public.commission_rules(id) ON DELETE RESTRICT,
    CONSTRAINT chk_commission_records_amount CHECK (commission_amount >= 0),
    CONSTRAINT chk_commission_records_status CHECK (status IN ('PAYABLE', 'CANCELLED')),
    CONSTRAINT chk_commission_records_cumulative_rev CHECK (cumulative_reversed_amount >= 0),
    CONSTRAINT chk_commission_records_remaining_pay CHECK (remaining_payable_amount >= 0),
    CONSTRAINT chk_commission_records_cancel_reason CHECK (cancel_reason IN ('CANCELLED_BY_REFUND', 'CANCELLED_BY_FRAUD', 'CANCELLED_BY_ADMIN')),
    CONSTRAINT chk_commission_records_payout_status CHECK (payout_status IN ('UNPAID', 'ALLOCATED', 'PAID')),
    CONSTRAINT chk_commission_records_ledger_status CHECK (ledger_status IN ('PENDING', 'POSTED', 'FAILED'))
);

-- ----------------------------------------------------------------------------
-- 2. COLUMN RECONCILIATION FOR EXISTING TABLES (Idempotent ADD COLUMN)
-- ----------------------------------------------------------------------------

-- 2.1 commission_recipients canonical columns
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'AFFILIATE';
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS payout_bank_name VARCHAR(100);
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS payout_account_number_masked VARCHAR(100);
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS payout_account_holder_name VARCHAR(255);
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS payout_account_number_encrypted TEXT;
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) DEFAULT 'system';
ALTER TABLE public.commission_recipients ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255) DEFAULT 'system';

-- 2.2 commission_rules canonical columns
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50) DEFAULT 'AFFILIATE';
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS recipient_id VARCHAR(255);
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS game_id VARCHAR(255);
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS product_id VARCHAR(255);
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS variant_id VARCHAR(255);
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS calculation_method VARCHAR(100);
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS rate NUMERIC(20, 2);
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(20, 2) DEFAULT 0;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS max_commission_amount NUMERIC(20, 2);
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 10;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS effective_from DATE;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS effective_until DATE;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) DEFAULT 'system';
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255) DEFAULT 'system';

-- 2.3 commission_records canonical columns
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS order_id VARCHAR(255);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS recipient_id VARCHAR(255);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS recipient_code VARCHAR(50);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50) DEFAULT 'AFFILIATE';
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS rule_id VARCHAR(255);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS rule_name VARCHAR(255);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS calculation_method VARCHAR(100);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS selling_price_snapshot NUMERIC(20, 2);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS base_cost_snapshot NUMERIC(20, 2);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS commission_rate_snapshot NUMERIC(10, 2);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS fixed_amount_snapshot NUMERIC(20, 2);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS commission_amount INTEGER;
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'IDR';
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PAYABLE';
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS cumulative_reversed_amount INTEGER DEFAULT 0;
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS remaining_payable_amount INTEGER DEFAULT 0;
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(255);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS reversal_snapshots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS payout_status VARCHAR(50) DEFAULT 'UNPAID';
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS payout_batch_id VARCHAR(255);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS ledger_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS ledger_journal_id VARCHAR(255);
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS ledger_posted_at TIMESTAMPTZ;
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS earned_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.commission_records ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 3. UNCONDITIONAL REMOVAL OF LEGACY CONSTRAINTS & REDUNDANT INDEXES
-- ----------------------------------------------------------------------------

-- 3.1 Unconditionally drop redundant index on code (uq_commission_recipients_code already provides unique btree index)
DROP INDEX IF EXISTS public.idx_commission_recipients_code;

-- 3.2 Unconditionally drop legacy auto-named unique and foreign key constraints
ALTER TABLE public.commission_recipients DROP CONSTRAINT IF EXISTS commission_recipients_code_key;
ALTER TABLE public.commission_recipients DROP CONSTRAINT IF EXISTS commission_recipients_user_id_fkey;
ALTER TABLE public.commission_rules DROP CONSTRAINT IF EXISTS commission_rules_recipient_id_fkey;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_order_id_fkey;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_recipient_id_fkey;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_rule_id_fkey;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_payout_batch_id_fkey;

-- 3.3 Unconditionally drop legacy check constraint names if present
ALTER TABLE public.commission_recipients DROP CONSTRAINT IF EXISTS commission_recipients_status_check;
ALTER TABLE public.commission_rules DROP CONSTRAINT IF EXISTS commission_rules_status_check;
ALTER TABLE public.commission_rules DROP CONSTRAINT IF EXISTS commission_rules_calculation_method_check;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_status_check;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_commission_amount_check;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_cancel_reason_check;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_payout_status_check;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_ledger_status_check;

-- ----------------------------------------------------------------------------
-- 4. TYPE NORMALIZATION (UUID -> VARCHAR(255) / STRICT PRE-DROP OF REFERENCING FKS)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    -- 4.1 Normalize commission_recipients.id to VARCHAR(255)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_recipients' 
          AND column_name = 'id' 
          AND data_type != 'character varying'
    ) THEN
        -- Drop any referencing foreign keys before altering primary key column type
        ALTER TABLE public.commission_rules DROP CONSTRAINT IF EXISTS fk_commission_rules_recipient_id;
        ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS fk_commission_records_recipient_id;

        ALTER TABLE public.commission_recipients ALTER COLUMN id TYPE VARCHAR(255) USING id::varchar;
    END IF;

    -- 4.2 Normalize commission_rules columns to VARCHAR(255)
    -- Drop referencing foreign key before altering commission_rules.id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_rules' 
          AND column_name = 'id' 
          AND data_type != 'character varying'
    ) THEN
        ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS fk_commission_records_rule_id;
        ALTER TABLE public.commission_rules ALTER COLUMN id TYPE VARCHAR(255) USING id::varchar;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_rules' 
          AND column_name = 'recipient_id' 
          AND data_type != 'character varying'
    ) THEN
        ALTER TABLE public.commission_rules DROP CONSTRAINT IF EXISTS fk_commission_rules_recipient_id;
        ALTER TABLE public.commission_rules ALTER COLUMN recipient_id TYPE VARCHAR(255) USING recipient_id::varchar;
    END IF;

    -- 4.3 Normalize commission_records columns to VARCHAR(255)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND column_name = 'id' 
          AND data_type != 'character varying'
    ) THEN
        ALTER TABLE public.commission_records ALTER COLUMN id TYPE VARCHAR(255) USING id::varchar;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND column_name = 'order_id' 
          AND data_type != 'character varying'
    ) THEN
        ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS fk_commission_records_order_id;
        ALTER TABLE public.commission_records ALTER COLUMN order_id TYPE VARCHAR(255) USING order_id::varchar;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND column_name = 'recipient_id' 
          AND data_type != 'character varying'
    ) THEN
        ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS fk_commission_records_recipient_id;
        ALTER TABLE public.commission_records ALTER COLUMN recipient_id TYPE VARCHAR(255) USING recipient_id::varchar;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND column_name = 'rule_id' 
          AND data_type != 'character varying'
    ) THEN
        ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS fk_commission_records_rule_id;
        ALTER TABLE public.commission_records ALTER COLUMN rule_id TYPE VARCHAR(255) USING rule_id::varchar;
    END IF;

    -- 4.4 Normalize payout_batch_id to VARCHAR(255) (Foreign key already dropped in Section 3)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND column_name = 'payout_batch_id' 
          AND data_type != 'character varying'
    ) THEN
        ALTER TABLE public.commission_records ALTER COLUMN payout_batch_id TYPE VARCHAR(255) USING payout_batch_id::varchar;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. NOT-NULL ENFORCEMENT FOR CANONICAL COLUMNS
-- ----------------------------------------------------------------------------

-- 5.1 commission_recipients canonical NOT NULL
ALTER TABLE public.commission_recipients ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.commission_recipients ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.commission_recipients ALTER COLUMN type SET NOT NULL;
ALTER TABLE public.commission_recipients ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.commission_recipients ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.commission_recipients ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.commission_recipients ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE public.commission_recipients ALTER COLUMN updated_by SET NOT NULL;

-- 5.2 commission_rules canonical NOT NULL
ALTER TABLE public.commission_rules ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN recipient_type SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN calculation_method SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN rate SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN min_order_amount SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN priority SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN effective_from SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE public.commission_rules ALTER COLUMN updated_by SET NOT NULL;

-- 5.3 commission_records canonical NOT NULL
ALTER TABLE public.commission_records ALTER COLUMN order_id SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN recipient_id SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN recipient_code SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN recipient_name SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN recipient_type SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN rule_id SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN rule_name SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN calculation_method SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN selling_price_snapshot SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN commission_rate_snapshot SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN fixed_amount_snapshot SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN commission_amount SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN cumulative_reversed_amount SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN remaining_payable_amount SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN reversal_snapshots SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN payout_status SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.commission_records ALTER COLUMN earned_at SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. CANONICAL CONSTRAINT CONVERGENCE (Exact Single Invariant & ON DELETE Rule)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    -- 6.1 COMMISSION RECIPIENTS CONSTRAINTS
    -- Canonical UNIQUE constraint on code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_recipients' 
          AND constraint_name = 'uq_commission_recipients_code'
    ) THEN
        ALTER TABLE public.commission_recipients ADD CONSTRAINT uq_commission_recipients_code UNIQUE (code);
    END IF;

    -- Canonical Status check constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_recipients' 
          AND constraint_name = 'chk_commission_recipients_status'
    ) THEN
        ALTER TABLE public.commission_recipients ADD CONSTRAINT chk_commission_recipients_status 
            CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE'));
    END IF;

    -- Canonical Foreign key to profiles (ON DELETE SET NULL)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.referential_constraints rc
        WHERE rc.constraint_schema = 'public' 
          AND rc.constraint_name = 'fk_commission_recipients_user_id'
          AND rc.delete_rule != 'SET NULL'
    ) THEN
        ALTER TABLE public.commission_recipients DROP CONSTRAINT fk_commission_recipients_user_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_recipients' 
          AND constraint_name = 'fk_commission_recipients_user_id'
    ) THEN
        ALTER TABLE public.commission_recipients ADD CONSTRAINT fk_commission_recipients_user_id 
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- 6.2 COMMISSION RULES CONSTRAINTS
    -- Canonical Foreign key to commission_recipients (ON DELETE SET NULL)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.referential_constraints rc
        WHERE rc.constraint_schema = 'public' 
          AND rc.constraint_name = 'fk_commission_rules_recipient_id'
          AND rc.delete_rule != 'SET NULL'
    ) THEN
        ALTER TABLE public.commission_rules DROP CONSTRAINT fk_commission_rules_recipient_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_rules' 
          AND constraint_name = 'fk_commission_rules_recipient_id'
    ) THEN
        ALTER TABLE public.commission_rules ADD CONSTRAINT fk_commission_rules_recipient_id 
            FOREIGN KEY (recipient_id) REFERENCES public.commission_recipients(id) ON DELETE SET NULL;
    END IF;

    -- Canonical Check constraint on calculation_method
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_rules' 
          AND constraint_name = 'chk_commission_rules_calc_method'
    ) THEN
        ALTER TABLE public.commission_rules ADD CONSTRAINT chk_commission_rules_calc_method 
            CHECK (calculation_method IN ('PERCENTAGE_OF_SELLING_PRICE', 'FIXED_AMOUNT', 'PERCENTAGE_OF_MARGIN'));
    END IF;

    -- Canonical Check constraint on status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_rules' 
          AND constraint_name = 'chk_commission_rules_status'
    ) THEN
        ALTER TABLE public.commission_rules ADD CONSTRAINT chk_commission_rules_status 
            CHECK (status IN ('ACTIVE', 'INACTIVE'));
    END IF;

    -- 6.3 COMMISSION RECORDS CONSTRAINTS
    -- Canonical Foreign key to orders (ON DELETE RESTRICT)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.referential_constraints rc
        WHERE rc.constraint_schema = 'public' 
          AND rc.constraint_name = 'fk_commission_records_order_id'
          AND rc.delete_rule != 'RESTRICT'
    ) THEN
        ALTER TABLE public.commission_records DROP CONSTRAINT fk_commission_records_order_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'fk_commission_records_order_id'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT fk_commission_records_order_id 
            FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;
    END IF;

    -- Canonical Foreign key to commission_recipients (ON DELETE RESTRICT)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.referential_constraints rc
        WHERE rc.constraint_schema = 'public' 
          AND rc.constraint_name = 'fk_commission_records_recipient_id'
          AND rc.delete_rule != 'RESTRICT'
    ) THEN
        ALTER TABLE public.commission_records DROP CONSTRAINT fk_commission_records_recipient_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'fk_commission_records_recipient_id'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT fk_commission_records_recipient_id 
            FOREIGN KEY (recipient_id) REFERENCES public.commission_recipients(id) ON DELETE RESTRICT;
    END IF;

    -- Canonical Foreign key to commission_rules (ON DELETE RESTRICT)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.referential_constraints rc
        WHERE rc.constraint_schema = 'public' 
          AND rc.constraint_name = 'fk_commission_records_rule_id'
          AND rc.delete_rule != 'RESTRICT'
    ) THEN
        ALTER TABLE public.commission_records DROP CONSTRAINT fk_commission_records_rule_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'fk_commission_records_rule_id'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT fk_commission_records_rule_id 
            FOREIGN KEY (rule_id) REFERENCES public.commission_rules(id) ON DELETE RESTRICT;
    END IF;

    -- Canonical Check constraint on commission_amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'chk_commission_records_amount'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT chk_commission_records_amount 
            CHECK (commission_amount >= 0);
    END IF;

    -- Canonical Check constraint on status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'chk_commission_records_status'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT chk_commission_records_status 
            CHECK (status IN ('PAYABLE', 'CANCELLED'));
    END IF;

    -- Canonical Check constraint on cumulative_reversed_amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'chk_commission_records_cumulative_rev'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT chk_commission_records_cumulative_rev 
            CHECK (cumulative_reversed_amount >= 0);
    END IF;

    -- Canonical Check constraint on remaining_payable_amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'chk_commission_records_remaining_pay'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT chk_commission_records_remaining_pay 
            CHECK (remaining_payable_amount >= 0);
    END IF;

    -- Canonical Check constraint on cancel_reason
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'chk_commission_records_cancel_reason'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT chk_commission_records_cancel_reason 
            CHECK (cancel_reason IN ('CANCELLED_BY_REFUND', 'CANCELLED_BY_FRAUD', 'CANCELLED_BY_ADMIN'));
    END IF;

    -- Canonical Check constraint on payout_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'chk_commission_records_payout_status'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT chk_commission_records_payout_status 
            CHECK (payout_status IN ('UNPAID', 'ALLOCATED', 'PAID'));
    END IF;

    -- Canonical Check constraint on ledger_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'commission_records' 
          AND constraint_name = 'chk_commission_records_ledger_status'
    ) THEN
        ALTER TABLE public.commission_records ADD CONSTRAINT chk_commission_records_ledger_status 
            CHECK (ledger_status IN ('PENDING', 'POSTED', 'FAILED'));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. INDEXES FOR QUERY OPTIMIZATION & WORKER POLLING
-- ----------------------------------------------------------------------------

-- Index for optional user profile lookup on recipients
CREATE INDEX IF NOT EXISTS idx_commission_recipients_user_id ON public.commission_recipients(user_id) WHERE user_id IS NOT NULL;
-- Note: 'uq_commission_recipients_code' provides the primary unique btree index on code.
-- Redundant 'idx_commission_recipients_code' was explicitly dropped in Section 3.

-- Index for rule resolution engine
CREATE INDEX IF NOT EXISTS idx_commission_rules_resolution ON public.commission_rules(status, recipient_type, priority);

-- Indexes for order-based lookup, recipient history, and batch allocation
CREATE INDEX IF NOT EXISTS idx_commission_records_order_id ON public.commission_records(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_recipient_id ON public.commission_records(recipient_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_payout_batch ON public.commission_records(payout_batch_id) WHERE payout_batch_id IS NOT NULL;

-- High-performance partial index for asynchronous ledger posting worker
CREATE INDEX IF NOT EXISTS idx_commission_records_ledger_queue ON public.commission_records(created_at) WHERE ledger_status = 'PENDING';

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.commission_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;

-- 8.1 Deny public, anon, and regular authenticated client access to all commission tables
DROP POLICY IF EXISTS "Deny all access to commission_recipients" ON public.commission_recipients;
CREATE POLICY "Deny all access to commission_recipients" 
ON public.commission_recipients 
FOR ALL 
TO anon, authenticated 
USING (false) 
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all access to commission_rules" ON public.commission_rules;
CREATE POLICY "Deny all access to commission_rules" 
ON public.commission_rules 
FOR ALL 
TO anon, authenticated 
USING (false) 
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all access to commission_records" ON public.commission_records;
CREATE POLICY "Deny all access to commission_records" 
ON public.commission_records 
FOR ALL 
TO anon, authenticated 
USING (false) 
WITH CHECK (false);

-- 8.2 Grant full server-side access strictly to service_role
DROP POLICY IF EXISTS "Allow service_role full access to commission_recipients" ON public.commission_recipients;
CREATE POLICY "Allow service_role full access to commission_recipients" 
ON public.commission_recipients 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to commission_rules" ON public.commission_rules;
CREATE POLICY "Allow service_role full access to commission_rules" 
ON public.commission_rules 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access to commission_records" ON public.commission_records;
CREATE POLICY "Allow service_role full access to commission_records" 
ON public.commission_records 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 9. PERMISSIONS & GRANTS
-- ----------------------------------------------------------------------------

-- Revoke all table privileges from public and client roles
REVOKE ALL ON TABLE public.commission_recipients FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.commission_rules FROM anon, authenticated, public;
REVOKE ALL ON TABLE public.commission_records FROM anon, authenticated, public;

-- Grant required table privileges exclusively to backend service_role
GRANT ALL ON TABLE public.commission_recipients TO service_role;
GRANT ALL ON TABLE public.commission_rules TO service_role;
GRANT ALL ON TABLE public.commission_records TO service_role;
