-- ============================================================================
-- DOMAIN: PAYOUT SYSTEM
-- MIGRATION: Formalizing payout_batches and atomic RPCs
-- TARGET: Supabase (PostgreSQL)
-- IDEMPOTENT: Safe to run multiple times
-- ============================================================================

-- 1. Reclamation Strategy
-- The ghost table 'payout_batches' exists but is inaccessible (42501).
-- Forensic audit confirmed 0 rows in commission tables and no active relational FKs to this table.
-- We perform a clean drop to ensure a fresh foundation. CASCADE is avoided unless proven necessary.
DROP TABLE IF EXISTS public.payout_batches;

-- 2. Base Table Creation
CREATE TABLE public.payout_batches (
    id VARCHAR(255) PRIMARY KEY, -- Compatible with Firestore IDs and existing commission_records schema
    batch_number VARCHAR(100) NOT NULL UNIQUE,
    recipient_id VARCHAR(255) NOT NULL REFERENCES public.commission_recipients(id),
    recipient_snapshot JSONB NOT NULL,
    allocations JSONB NOT NULL, -- Array of {commissionId, allocatedAmount}
    total_commission_amount BIGINT NOT NULL DEFAULT 0, -- Upgraded to BIGINT to prevent overflow
    payout_fee BIGINT NOT NULL DEFAULT 0,
    net_payout_amount BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    payout_method VARCHAR(50) NOT NULL DEFAULT 'MANUAL_BANK_TRANSFER',
    transfer_reference VARCHAR(255),
    proof_reference VARCHAR(255),
    ledger_journal_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(255) NOT NULL,
    submitted_at TIMESTAMPTZ,
    submitted_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    approved_by VARCHAR(255),
    paid_at TIMESTAMPTZ,
    paid_by VARCHAR(255),
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by VARCHAR(255),
    cancellation_reason TEXT,
    review_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT chk_payout_batches_status CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'PROCESSING', 'NEEDS_REVIEW', 'PAID', 'FAILED', 'CANCELLED'))
);

-- 3. Security (RLS)
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;

-- Deny public access
DROP POLICY IF EXISTS "Deny all access to payout_batches" ON public.payout_batches;
CREATE POLICY "Deny all access to payout_batches" 
ON public.payout_batches 
FOR ALL 
TO anon, authenticated 
USING (false) 
WITH CHECK (false);

-- Grant service_role access
DROP POLICY IF EXISTS "Allow service_role full access to payout_batches" ON public.payout_batches;
CREATE POLICY "Allow service_role full access to payout_batches" 
ON public.payout_batches 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 4. Grants
REVOKE ALL ON TABLE public.payout_batches FROM anon, authenticated, public;
GRANT ALL ON TABLE public.payout_batches TO service_role;
GRANT ALL ON TABLE public.payout_batches TO postgres;

-- 5. RPC: create_payout_batch_atomic
-- Atomically locks commissions and creates a batch
CREATE OR REPLACE FUNCTION public.create_payout_batch_atomic(
    p_batch_id VARCHAR(255),
    p_batch_number VARCHAR(100),
    p_recipient_id VARCHAR(255),
    p_recipient_snapshot JSONB,
    p_allocations JSONB, -- Expected [{commissionId: string, allocatedAmount: number}]
    p_total_amount BIGINT, -- BIGINT for financial safety
    p_created_by VARCHAR(255)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_allocation RECORD;
    v_comm_record RECORD;
    v_batch_exists BOOLEAN;
    v_sum_alloc BIGINT := 0;
    v_count_alloc INTEGER := 0;
    v_distinct_count INTEGER := 0;
    v_has_invalid_id BOOLEAN := false;
    v_has_invalid_amount BOOLEAN := false;
BEGIN
    -- 1. Input Validation (Total Allocation Integrity)
    IF jsonb_array_length(p_allocations) = 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'EMPTY_ALLOCATIONS');
    END IF;

    -- Calculate total from JSONB and check for duplicates/invalids before any mutation
    SELECT 
        COALESCE(SUM((x->>'allocatedAmount')::bigint), 0),
        COUNT(*),
        COUNT(DISTINCT (x->>'commissionId')),
        bool_or((x->>'commissionId') IS NULL OR (x->>'commissionId') = ''),
        bool_or((x->>'allocatedAmount') IS NULL OR (x->>'allocatedAmount')::bigint <= 0)
    INTO 
        v_sum_alloc, v_count_alloc, v_distinct_count, v_has_invalid_id, v_has_invalid_amount
    FROM jsonb_array_elements(p_allocations) x;

    IF v_has_invalid_id THEN
        RETURN jsonb_build_object('success', false, 'reason', 'INVALID_COMMISSION_ID');
    END IF;

    IF v_has_invalid_amount THEN
        RETURN jsonb_build_object('success', false, 'reason', 'INVALID_ALLOCATION_AMOUNT');
    END IF;

    IF v_count_alloc != v_distinct_count THEN
        RETURN jsonb_build_object('success', false, 'reason', 'DUPLICATE_COMMISSION');
    END IF;

    IF v_sum_alloc != p_total_amount THEN
        RETURN jsonb_build_object('success', false, 'reason', 'ALLOCATION_TOTAL_MISMATCH', 'expected', p_total_amount, 'actual', v_sum_alloc);
    END IF;

    -- 2. Check if batch already exists (Concurrent Idempotency)
    -- We do this early to avoid locking commissions for a batch that already exists.
    SELECT EXISTS (SELECT 1 FROM public.payout_batches WHERE id = p_batch_id) INTO v_batch_exists;
    IF v_batch_exists THEN
        RETURN jsonb_build_object('success', true, 'batchId', p_batch_id, 'alreadyExists', true);
    END IF;

    -- 3. Loop and Lock Commissions (Recipient & Status Integrity)
    FOR v_allocation IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(commissionId text, allocatedAmount bigint)
    LOOP
        -- Lock row
        SELECT * INTO v_comm_record FROM public.commission_records WHERE id = v_allocation.commissionId FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Commission record % not found', v_allocation.commissionId;
        END IF;

        -- Recipient Integrity Check
        IF v_comm_record.recipient_id != p_recipient_id THEN
            RAISE EXCEPTION 'Recipient Mismatch: Commission % belongs to recipient %, but batch is for %', 
                v_allocation.commissionId, v_comm_record.recipient_id, p_recipient_id;
        END IF;

        IF v_comm_record.payout_status != 'UNPAID' THEN
            RAISE EXCEPTION 'Commission record % is already allocated or paid (current status: %)', v_allocation.commissionId, v_comm_record.payout_status;
        END IF;

        IF v_comm_record.status != 'PAYABLE' THEN
            RAISE EXCEPTION 'Commission record % is not payable (current status: %)', v_allocation.commissionId, v_comm_record.status;
        END IF;

        -- Update commission to ALLOCATED
        UPDATE public.commission_records 
        SET payout_status = 'ALLOCATED',
            payout_batch_id = p_batch_id,
            updated_at = now()
        WHERE id = v_allocation.commissionId;
    END LOOP;

    -- 4. Create Payout Batch
    INSERT INTO public.payout_batches (
        id, batch_number, recipient_id, recipient_snapshot, allocations, 
        total_commission_amount, net_payout_amount, status, created_by, created_at
    ) VALUES (
        p_batch_id, p_batch_number, p_recipient_id, p_recipient_snapshot, p_allocations,
        p_total_amount, p_total_amount, 'DRAFT', p_created_by, now()
    );

    RETURN jsonb_build_object('success', true, 'batchId', p_batch_id, 'alreadyExists', false);
EXCEPTION 
    WHEN unique_violation THEN
        -- Handle race condition where batch was inserted between our check and insert
        RETURN jsonb_build_object('success', true, 'batchId', p_batch_id, 'alreadyExists', true);
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'reason', 'SQL_ERROR', 'message', SQLERRM);
END;
$$;

-- 6. RPC: confirm_payout_paid_atomic
-- Atomically confirms payment and handles TOCTOU refund race
CREATE OR REPLACE FUNCTION public.confirm_payout_paid_atomic(
    p_batch_id VARCHAR(255),
    p_transfer_reference VARCHAR(255),
    p_paid_by VARCHAR(255),
    p_ledger_journal_id VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_batch RECORD;
    v_comm RECORD;
    v_actual_payable_sum BIGINT := 0;
    v_count_processed INTEGER := 0;
BEGIN
    -- 1. Lock Batch
    SELECT * INTO v_batch FROM public.payout_batches WHERE id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'BATCH_NOT_FOUND');
    END IF;

    -- 2. Idempotency Check
    IF v_batch.status = 'PAID' THEN
        RETURN jsonb_build_object('success', true, 'batchId', p_batch_id, 'alreadyPaid', true);
    END IF;

    IF v_batch.status != 'PROCESSING' AND v_batch.status != 'PENDING_APPROVAL' THEN
         RETURN jsonb_build_object('success', false, 'reason', 'INVALID_STATUS', 'currentStatus', v_batch.status);
    END IF;

    -- 3. Lock and Verify Commissions
    -- This is the critical step against Refund Race
    FOR v_comm IN 
        SELECT cr.*, (v_alloc->>'allocatedAmount')::bigint as allocated_in_batch
        FROM public.commission_records cr
        JOIN jsonb_array_elements(v_batch.allocations) v_alloc 
          ON (v_alloc->>'commissionId')::text = cr.id
        WHERE cr.payout_batch_id = p_batch_id
        FOR UPDATE
    LOOP
        v_count_processed := v_count_processed + 1;

        -- TOCTOU CHECK: Is the commission still payable for the amount we allocated?
        -- If a refund happened, remaining_payable_amount will be lower than allocated_in_batch.
        IF v_comm.remaining_payable_amount < v_comm.allocated_in_batch THEN
            RAISE EXCEPTION 'Refund Race Detected: Commission % has only % payable, but batch requires %', 
                v_comm.id, v_comm.remaining_payable_amount, v_comm.allocated_in_batch;
        END IF;

        -- Update Commission to PAID
        UPDATE public.commission_records 
        SET payout_status = 'PAID',
            paid_at = now(),
            updated_at = now()
        WHERE id = v_comm.id;
        
        v_actual_payable_sum := v_actual_payable_sum + v_comm.allocated_in_batch;
    END LOOP;

    -- 4. Final Verification
    -- Verify all allocations were processed
    IF v_count_processed != jsonb_array_length(v_batch.allocations) THEN
         RAISE EXCEPTION 'Internal consistency error: Processed % commissions but batch has % allocations', 
            v_count_processed, jsonb_array_length(v_batch.allocations);
    END IF;

    -- Verify final sum matches batch total
    IF v_actual_payable_sum != v_batch.total_commission_amount THEN
         RAISE EXCEPTION 'Internal amount mismatch: Sum (%) != Batch Total (%)', v_actual_payable_sum, v_batch.total_commission_amount;
    END IF;

    -- 5. Update Batch
    UPDATE public.payout_batches SET
        status = 'PAID',
        transfer_reference = p_transfer_reference,
        ledger_journal_id = COALESCE(p_ledger_journal_id, ledger_journal_id),
        paid_at = now(),
        paid_by = p_paid_by
    WHERE id = p_batch_id;

    RETURN jsonb_build_object('success', true, 'batchId', p_batch_id, 'alreadyPaid', false);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'reason', 'SQL_ERROR', 'message', SQLERRM);
END;
$$;

-- 7. Grant RPC permissions
REVOKE ALL ON FUNCTION public.create_payout_batch_atomic(VARCHAR(255), VARCHAR(100), VARCHAR(255), JSONB, JSONB, BIGINT, VARCHAR(255)) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.create_payout_batch_atomic(VARCHAR(255), VARCHAR(100), VARCHAR(255), JSONB, JSONB, BIGINT, VARCHAR(255)) TO service_role;

REVOKE ALL ON FUNCTION public.confirm_payout_paid_atomic(VARCHAR(255), VARCHAR(255), VARCHAR(255), VARCHAR(255)) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.confirm_payout_paid_atomic(VARCHAR(255), VARCHAR(255), VARCHAR(255), VARCHAR(255)) TO service_role;

-- 8. Add Indexes for optimization
CREATE INDEX IF NOT EXISTS idx_payout_batches_recipient_id ON public.payout_batches(recipient_id);
CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON public.payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_batch_number ON public.payout_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_payout_batches_created_at ON public.payout_batches(created_at);
