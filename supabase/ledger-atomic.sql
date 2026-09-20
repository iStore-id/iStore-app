-- ----------------------------------------------------------------------------
-- Phase 2B Remediation: Add non-negative constraint support
-- ----------------------------------------------------------------------------
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS is_non_negative BOOLEAN DEFAULT false;

-- ============================================================================
-- DOMAIN: RELATIONAL DOUBLE-ENTRY LEDGER ATOMIC POSTING ENGINE
-- MIGRATION: Phase 4G / 4H-C - Atomic Posting RPC with Forensic Hardening
-- FUNCTION: public.post_ledger_journal
-- TARGET: Supabase (PostgreSQL)
-- IDEMPOTENT: Safe to run multiple times, deterministic retry handling
-- ============================================================================

-- Ensure pgcrypto is available for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.post_ledger_journal(
    p_idempotency_key VARCHAR(255),
    p_event_type VARCHAR(100),
    p_source_type VARCHAR(100),
    p_source_id VARCHAR(255),
    p_currency VARCHAR(10),
    p_total_amount NUMERIC(20, 2),
    p_reversal_of UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_entries JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_journal RECORD;
    v_original_journal RECORD;
    v_journal_id UUID;
    v_entry JSONB;
    v_account RECORD;
    v_account_id VARCHAR(255);
    v_entry_currency VARCHAR(10);
    v_debit NUMERIC(20, 2);
    v_credit NUMERIC(20, 2);
    v_sum_debit NUMERIC(20, 2) := 0;
    v_sum_credit NUMERIC(20, 2) := 0;
    v_already_reversed NUMERIC(20, 2) := 0;
    v_effective_currency VARCHAR(10);
    v_entry_count INTEGER;
    v_acc_record RECORD;
    v_existing_entries_canonical JSONB;
    v_incoming_entries_canonical JSONB;
    v_orig_count INTEGER;
    v_rev_count INTEGER;
    v_unmatched_lines INTEGER;
    v_ratio NUMERIC(20, 8);
    v_new_balance NUMERIC(20, 2);
    v_acc_ids VARCHAR(255)[];
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. Input Sanity & Argument Validation
    -- ------------------------------------------------------------------------
    IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: idempotency_key is required and cannot be empty'
            USING ERRCODE = '22023';
    END IF;

    IF p_event_type IS NULL OR TRIM(p_event_type) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: event_type is required and cannot be empty'
            USING ERRCODE = '22023';
    END IF;

    IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: total_amount must be strictly positive (got %)', p_total_amount
            USING ERRCODE = '22023';
    END IF;

    v_effective_currency := UPPER(TRIM(COALESCE(p_currency, 'IDR')));
    IF v_effective_currency = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: currency cannot be empty'
            USING ERRCODE = '22023';
    END IF;

    -- Entry structure pre-validation
    IF p_entries IS NULL OR jsonb_typeof(p_entries) != 'array' THEN
        RAISE EXCEPTION 'INVALID_ENTRIES: p_entries must be a valid JSONB array'
            USING ERRCODE = '22023';
    END IF;

    v_entry_count := jsonb_array_length(p_entries);
    IF v_entry_count < 2 THEN
        RAISE EXCEPTION 'INVALID_ENTRIES: Double-entry accounting requires at least 2 entries (got %)', v_entry_count
            USING ERRCODE = '22023';
    END IF;

    -- ------------------------------------------------------------------------
    -- 2. Idempotency Check (Header AND Canonical Entries Comparison)
    -- ------------------------------------------------------------------------
    SELECT * INTO v_existing_journal
    FROM public.ledger_journals
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        WITH raw_incoming AS (
            SELECT 
                TRIM(e->>'account_id')::VARCHAR(255) AS account_id,
                COALESCE((e->>'debit')::NUMERIC, 0) AS debit,
                COALESCE((e->>'credit')::NUMERIC, 0) AS credit,
                UPPER(TRIM(COALESCE(e->>'currency', v_effective_currency)))::VARCHAR(10) AS currency
            FROM jsonb_array_elements(p_entries) AS e
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                'account_id', account_id,
                'debit', debit,
                'credit', credit,
                'currency', currency
            ) ORDER BY account_id ASC, debit ASC, credit ASC, currency ASC
        ) INTO v_incoming_entries_canonical
        FROM raw_incoming;

        SELECT jsonb_agg(
            jsonb_build_object(
                'account_id', account_id,
                'debit', debit,
                'credit', credit,
                'currency', currency
            ) ORDER BY account_id ASC, debit ASC, credit ASC, currency ASC
        ) INTO v_existing_entries_canonical
        FROM public.ledger_entries
        WHERE journal_id = v_existing_journal.id;

        IF v_existing_journal.event_type = p_event_type
           AND v_existing_journal.total_amount = p_total_amount
           AND v_existing_journal.currency = v_effective_currency
           AND (v_existing_journal.source_type IS NOT DISTINCT FROM p_source_type)
           AND (v_existing_journal.source_id IS NOT DISTINCT FROM p_source_id)
           AND (v_existing_journal.reversal_of IS NOT DISTINCT FROM p_reversal_of)
           AND (v_existing_entries_canonical = v_incoming_entries_canonical)
        THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'ALREADY_PROCESSED',
                'journal_id', v_existing_journal.id,
                'idempotency_key', v_existing_journal.idempotency_key,
                'event_type', v_existing_journal.event_type,
                'source_type', v_existing_journal.source_type,
                'source_id', v_existing_journal.source_id,
                'currency', v_existing_journal.currency,
                'total_amount', v_existing_journal.total_amount,
                'reversal_of', v_existing_journal.reversal_of,
                'created_at', v_existing_journal.created_at,
                'message', 'Journal already posted with identical idempotency key and matching payload.'
            );
        ELSE
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Idempotency key "%" already exists with conflicting payload', p_idempotency_key
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- ------------------------------------------------------------------------
    -- 3. Reversal Validation (Row-Level Locking & Line-Mapping Verification)
    -- ------------------------------------------------------------------------
    IF p_reversal_of IS NOT NULL THEN
        SELECT * INTO v_original_journal
        FROM public.ledger_journals
        WHERE id = p_reversal_of
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ORIGINAL_JOURNAL_NOT_FOUND: Reversal references non-existent journal "%"', p_reversal_of
                USING ERRCODE = '23503';
        END IF;

        IF v_original_journal.reversal_of IS NOT NULL THEN
            RAISE EXCEPTION 'INVALID_REVERSAL: Cannot reverse journal "%" which is itself a reversal of "%"', p_reversal_of, v_original_journal.reversal_of
                USING ERRCODE = '22023';
        END IF;

        IF v_original_journal.currency != v_effective_currency THEN
            RAISE EXCEPTION 'REVERSAL_CURRENCY_MISMATCH: Reversal currency "%" does not match original journal currency "%"', v_effective_currency, v_original_journal.currency
                USING ERRCODE = '22023';
        END IF;

        SELECT COALESCE(SUM(total_amount), 0) INTO v_already_reversed
        FROM public.ledger_journals
        WHERE reversal_of = p_reversal_of;

        IF (v_already_reversed + p_total_amount) > v_original_journal.total_amount THEN
            RAISE EXCEPTION 'REVERSAL_AMOUNT_EXCEEDED: Cumulative reversals (% + %) exceed original journal total_amount (%) for journal "%"', v_already_reversed, p_total_amount, v_original_journal.total_amount, p_reversal_of
                USING ERRCODE = '22023';
        END IF;

        v_ratio := p_total_amount / v_original_journal.total_amount;

        SELECT COUNT(DISTINCT account_id) INTO v_orig_count
        FROM public.ledger_entries
        WHERE journal_id = p_reversal_of;

        SELECT COUNT(DISTINCT TRIM(e->>'account_id')) INTO v_rev_count
        FROM jsonb_array_elements(p_entries) AS e;

        IF v_orig_count != v_rev_count THEN
            RAISE EXCEPTION 'REVERSAL_LINE_MAPPING_MISMATCH: Reversal accounts count (%) does not match original journal accounts count (%)', v_rev_count, v_orig_count
                USING ERRCODE = '22023';
        END IF;

        WITH orig_summary AS (
            SELECT 
                account_id,
                SUM(debit) AS orig_debit,
                SUM(credit) AS orig_credit
            FROM public.ledger_entries
            WHERE journal_id = p_reversal_of
            GROUP BY account_id
        ),
        rev_summary AS (
            SELECT 
                TRIM(e->>'account_id')::VARCHAR(255) AS account_id,
                SUM(COALESCE((e->>'debit')::NUMERIC, 0)) AS rev_debit,
                SUM(COALESCE((e->>'credit')::NUMERIC, 0)) AS rev_credit
            FROM jsonb_array_elements(p_entries) AS e
            GROUP BY TRIM(e->>'account_id')::VARCHAR(255)
        )
        SELECT COUNT(*) INTO v_unmatched_lines
        FROM orig_summary o
        FULL OUTER JOIN rev_summary r ON r.account_id = o.account_id
        WHERE r.account_id IS NULL 
           OR o.account_id IS NULL
           OR ABS(r.rev_debit - ROUND(o.orig_credit * v_ratio, 2)) > 0.05
           OR ABS(r.rev_credit - ROUND(o.orig_debit * v_ratio, 2)) > 0.05;

        IF v_unmatched_lines > 0 THEN
            RAISE EXCEPTION 'REVERSAL_LINE_MAPPING_MISMATCH: Reversal entries do not properly invert original journal entries for journal "%"', p_reversal_of
                USING ERRCODE = '22023';
        END IF;
    END IF;

    -- ------------------------------------------------------------------------
    -- 4. Line Items Validation & Collect Account IDs for Locking
    -- ------------------------------------------------------------------------
    v_acc_ids := ARRAY(SELECT DISTINCT TRIM(e->>'account_id')::VARCHAR(255) FROM jsonb_array_elements(p_entries) AS e);
    
    -- Lock all involved accounts to ensure atomic concurrency
    FOR v_account_id IN SELECT DISTINCT unnest(v_acc_ids)
    LOOP
        PERFORM pg_advisory_xact_lock(hashtext(v_account_id));
    END LOOP;
    
    PERFORM id FROM public.account_balances WHERE account_id = ANY(v_acc_ids) FOR UPDATE;

    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
    LOOP
        v_account_id := TRIM(COALESCE(v_entry->>'account_id', ''));
        IF v_account_id = '' THEN
            RAISE EXCEPTION 'INVALID_ENTRY: account_id is required for every entry'
                USING ERRCODE = '22023';
        END IF;

        v_debit := COALESCE((v_entry->>'debit')::NUMERIC, 0);
        v_credit := COALESCE((v_entry->>'credit')::NUMERIC, 0);

        IF v_debit < 0 OR v_credit < 0 THEN
            RAISE EXCEPTION 'NEGATIVE_AMOUNT: Entry debit (%) and credit (%) must be non-negative (account: %)', v_debit, v_credit, v_account_id
                USING ERRCODE = '22023';
        END IF;

        IF v_debit = 0 AND v_credit = 0 THEN
            RAISE EXCEPTION 'ZERO_ENTRY: Entry cannot have both debit = 0 and credit = 0 (account: %)', v_account_id
                USING ERRCODE = '22023';
        END IF;

        IF v_debit > 0 AND v_credit > 0 THEN
            RAISE EXCEPTION 'DUAL_SIDED_ENTRY: Entry cannot have both debit > 0 and credit > 0 (account: %)', v_account_id
                USING ERRCODE = '22023';
        END IF;

        v_entry_currency := UPPER(TRIM(COALESCE(v_entry->>'currency', v_effective_currency)));
        IF v_entry_currency != v_effective_currency THEN
            RAISE EXCEPTION 'CURRENCY_MISMATCH: Entry currency "%" does not match journal currency "%" (account: %)', v_entry_currency, v_effective_currency, v_account_id
                USING ERRCODE = '22023';
        END IF;

        SELECT * INTO v_account
        FROM public.ledger_accounts
        WHERE id = v_account_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Account with ID "%" does not exist in ledger_accounts', v_account_id
                USING ERRCODE = '23503';
        END IF;

        IF NOT v_account.is_active THEN
            RAISE EXCEPTION 'ACCOUNT_INACTIVE: Account "%" (%) is currently inactive and cannot receive postings', v_account.name, v_account_id
                USING ERRCODE = '22023';
        END IF;

        v_sum_debit := v_sum_debit + v_debit;
        v_sum_credit := v_sum_credit + v_credit;
    END LOOP;

    -- ------------------------------------------------------------------------
    -- 5. Balanced Double-Entry Invariant: SUM(debit) == SUM(credit)
    -- ------------------------------------------------------------------------
    IF v_sum_debit != v_sum_credit THEN
        RAISE EXCEPTION 'UNBALANCED_JOURNAL: Total debit (%) must equal total credit (%)', v_sum_debit, v_sum_credit
            USING ERRCODE = '22023';
    END IF;

    -- ------------------------------------------------------------------------
    -- 6. Total Amount Reconciliation: SUM(debit) == total_amount
    -- ------------------------------------------------------------------------
    IF v_sum_debit != p_total_amount THEN
        RAISE EXCEPTION 'TOTAL_AMOUNT_MISMATCH: Sum of debit/credit entries (%) does not match specified total_amount (%)', v_sum_debit, p_total_amount
            USING ERRCODE = '22023';
    END IF;

    -- ------------------------------------------------------------------------
    -- 7. Insert Header Record into public.ledger_journals
    -- ------------------------------------------------------------------------
    INSERT INTO public.ledger_journals (
        idempotency_key,
        event_type,
        source_type,
        source_id,
        currency,
        total_amount,
        reversal_of,
        metadata,
        created_at
    ) VALUES (
        p_idempotency_key,
        p_event_type,
        p_source_type,
        p_source_id,
        v_effective_currency,
        p_total_amount,
        p_reversal_of,
        COALESCE(p_metadata, '{}'::jsonb),
        NOW()
    ) RETURNING id INTO v_journal_id;

    -- ------------------------------------------------------------------------
    -- 8. Insert Detail Line Items into public.ledger_entries
    -- ------------------------------------------------------------------------
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
    LOOP
        INSERT INTO public.ledger_entries (
            journal_id,
            account_id,
            debit,
            credit,
            currency,
            created_at
        ) VALUES (
            v_journal_id,
            TRIM(v_entry->>'account_id'),
            COALESCE((v_entry->>'debit')::NUMERIC, 0),
            COALESCE((v_entry->>'credit')::NUMERIC, 0),
            v_effective_currency,
            NOW()
        );
    END LOOP;

    -- ------------------------------------------------------------------------
    -- 9. Update Materialized Account Balances
    -- ------------------------------------------------------------------------
    FOR v_acc_record IN
        WITH entry_rows AS (
            SELECT 
                TRIM(e->>'account_id')::VARCHAR(255) AS account_id,
                COALESCE((e->>'debit')::NUMERIC, 0) AS debit,
                COALESCE((e->>'credit')::NUMERIC, 0) AS credit
            FROM jsonb_array_elements(p_entries) AS e
        ),
        aggregated AS (
            SELECT 
                r.account_id,
                SUM(r.debit) AS total_debit,
                SUM(r.credit) AS total_credit
            FROM entry_rows r
            GROUP BY r.account_id
        )
        SELECT 
            a.account_id,
            acc.normal_balance,
            acc.is_non_negative,
            CASE 
                WHEN acc.normal_balance = 'DEBIT' THEN (a.total_debit - a.total_credit)
                ELSE (a.total_credit - a.total_debit)
            END AS net_delta
        FROM aggregated a
        JOIN public.ledger_accounts acc ON acc.id = a.account_id
        ORDER BY a.account_id ASC
    LOOP
        -- Check projected balance
        SELECT balance INTO v_new_balance FROM public.account_balances WHERE account_id = v_acc_record.account_id AND currency = v_effective_currency;
        v_new_balance := COALESCE(v_new_balance, 0) + v_acc_record.net_delta;

        IF v_acc_record.is_non_negative AND v_new_balance < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Operation results in negative balance for account %', v_acc_record.account_id
                USING ERRCODE = '22003';
        END IF;

        INSERT INTO public.account_balances (
            account_id,
            currency,
            balance,
            updated_at
        ) VALUES (
            v_acc_record.account_id,
            v_effective_currency,
            v_acc_record.net_delta,
            NOW()
        )
        ON CONFLICT (account_id, currency)
        DO UPDATE SET
            balance = public.account_balances.balance + EXCLUDED.balance,
            updated_at = NOW();
    END LOOP;

    -- ------------------------------------------------------------------------
    -- 10. Return Success Result
    -- ------------------------------------------------------------------------
    RETURN jsonb_build_object(
        'success', true,
        'status', 'POSTED',
        'journal_id', v_journal_id,
        'idempotency_key', p_idempotency_key,
        'event_type', p_event_type,
        'source_type', p_source_type,
        'source_id', p_source_id,
        'currency', v_effective_currency,
        'total_amount', p_total_amount,
        'entries_count', v_entry_count,
        'reversal_of', p_reversal_of,
        'created_at', NOW()
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. Security & Execution Privilege Configuration
-- ----------------------------------------------------------------------------
-- Revoke all permissions from anon, authenticated, public
REVOKE ALL ON FUNCTION public.post_ledger_journal(
    VARCHAR(255), VARCHAR(100), VARCHAR(100), VARCHAR(255), VARCHAR(10), NUMERIC(20, 2), UUID, JSONB, JSONB
) FROM anon, authenticated, public;

-- Grant execute permissions strictly to service_role (backend execution)
GRANT EXECUTE ON FUNCTION public.post_ledger_journal(
    VARCHAR(255), VARCHAR(100), VARCHAR(100), VARCHAR(255), VARCHAR(10), NUMERIC(20, 2), UUID, JSONB, JSONB
) TO service_role;
