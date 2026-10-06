-- ============================================================================
-- DOMAIN: PAYOUT SYSTEM
-- MIGRATION: Remedial RPC & Reference Integrity (Phase 5B.3D)
-- TARGET: Supabase (PostgreSQL)
-- OBJECTIVE: Fix P1 Blockers (Function Overload, Cancel Whitelist, Security)
-- ============================================================================

-- 1. Function Cleanup (FIX P1)
-- Explicitly drop the old signature to prevent function overloading/ambiguity.
-- The previous version had 4 arguments; the new one has 5.
DROP FUNCTION IF EXISTS public.confirm_payout_paid_atomic(VARCHAR, VARCHAR, VARCHAR, VARCHAR);

-- 2. Reference Integrity: Transfer Reference Uniqueness
-- Moving 'payoutReferenceReservations' from Firestore to PostgreSQL.
-- Ensures a bank transfer reference cannot be reused for multiple PAID batches.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_batches_unique_paid_reference 
ON public.payout_batches (TRIM(transfer_reference)) 
WHERE status = 'PAID' AND transfer_reference IS NOT NULL;

-- 3. Updated RPC: confirm_payout_paid_atomic (5 arguments)
CREATE OR REPLACE FUNCTION public.confirm_payout_paid_atomic(
    p_batch_id VARCHAR(255),
    p_transfer_reference VARCHAR(255),
    p_proof_reference VARCHAR(255), -- Persists link to receipt/proof
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

    -- Only specific statuses can be marked PAID
    IF v_batch.status NOT IN ('PROCESSING', 'PENDING_APPROVAL', 'NEEDS_REVIEW') THEN
         RETURN jsonb_build_object('success', false, 'reason', 'INVALID_STATUS', 'currentStatus', v_batch.status);
    END IF;

    -- 3. Lock and Verify Commissions (Anti-Refund Race)
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
        IF v_comm.remaining_payable_amount < v_comm.allocated_in_batch THEN
            RAISE EXCEPTION 'Refund Race Detected: Commission % has only % payable, but batch requires %', 
                v_comm.id, v_comm.remaining_payable_amount, v_comm.allocated_in_batch;
        END IF;

        -- Check Status Integrity
        IF v_comm.payout_status != 'ALLOCATED' THEN
             RAISE EXCEPTION 'Internal Integrity Error: Commission % is not ALLOCATED (status: %)', v_comm.id, v_comm.payout_status;
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
        transfer_reference = TRIM(p_transfer_reference),
        proof_reference = TRIM(p_proof_reference),
        ledger_journal_id = COALESCE(p_ledger_journal_id, ledger_journal_id),
        paid_at = now(),
        paid_by = p_paid_by,
        updated_at = now()
    WHERE id = p_batch_id;

    RETURN jsonb_build_object('success', true, 'batchId', p_batch_id, 'alreadyPaid', false);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'reason', 'SQL_ERROR', 'message', SQLERRM);
END;
$$;

-- 4. New RPC: cancel_payout_batch_atomic
CREATE OR REPLACE FUNCTION public.cancel_payout_batch_atomic(
    p_batch_id VARCHAR(255),
    p_cancelled_by VARCHAR(255),
    p_cancellation_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_batch RECORD;
    v_comm RECORD;
    v_count_unlocked INTEGER := 0;
BEGIN
    -- 1. Lock Batch
    SELECT * INTO v_batch FROM public.payout_batches WHERE id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'BATCH_NOT_FOUND');
    END IF;

    -- 2. Idempotency Check
    IF v_batch.status = 'CANCELLED' THEN
        RETURN jsonb_build_object('success', true, 'batchId', p_batch_id, 'alreadyCancelled', true);
    END IF;

    -- 3. Status Validation (FIX P2: Whitelist)
    IF v_batch.status = 'PAID' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'CANNOT_CANCEL_PAID_BATCH');
    END IF;

    IF v_batch.status NOT IN ('DRAFT', 'PENDING_APPROVAL', 'PROCESSING', 'NEEDS_REVIEW') THEN
         RETURN jsonb_build_object('success', false, 'reason', 'INVALID_STATUS', 'currentStatus', v_batch.status);
    END IF;

    -- 4. Lock and Unlock Commissions
    FOR v_comm IN 
        SELECT * FROM public.commission_records 
        WHERE payout_batch_id = p_batch_id 
        FOR UPDATE
    LOOP
        v_count_unlocked := v_count_unlocked + 1;

        -- Safety Check
        IF v_comm.payout_status != 'ALLOCATED' THEN
             RAISE EXCEPTION 'Internal Integrity Error: Commission % in batch % is status %', v_comm.id, p_batch_id, v_comm.payout_status;
        END IF;

        UPDATE public.commission_records 
        SET payout_status = 'UNPAID',
            payout_batch_id = NULL,
            updated_at = now()
        WHERE id = v_comm.id;
    END LOOP;

    -- 5. Update Batch Status
    UPDATE public.payout_batches SET
        status = 'CANCELLED',
        cancelled_at = now(),
        cancelled_by = p_cancelled_by,
        cancellation_reason = p_cancellation_reason,
        updated_at = now()
    WHERE id = p_batch_id;

    RETURN jsonb_build_object('success', true, 'batchId', p_batch_id, 'alreadyCancelled', false, 'unlockedCount', v_count_unlocked);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'reason', 'SQL_ERROR', 'message', SQLERRM);
END;
$$;

-- 5. Security: Grants & Revokes
-- Revoke all existing access
REVOKE ALL ON FUNCTION public.confirm_payout_paid_atomic(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.cancel_payout_batch_atomic(VARCHAR, VARCHAR, TEXT) FROM anon, authenticated, public;

-- Grant strictly to service_role
GRANT EXECUTE ON FUNCTION public.confirm_payout_paid_atomic(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_payout_batch_atomic(VARCHAR, VARCHAR, TEXT) TO service_role;
