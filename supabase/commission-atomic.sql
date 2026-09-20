-- ============================================================================
-- DOMAIN: COMMISSION SYSTEM ATOMIC PROCEDURES
-- DESCRIPTION: Atomic PL/pgSQL RPCs for Commission clawback and partial refund handling.
-- TARGET: Supabase (PostgreSQL)
-- IDEMPOTENT: Safe to run multiple times, immune to repeated / partial refunds
-- ============================================================================

-- 1. Atomic Commission Refund Reversal (Clawback Engine)
CREATE OR REPLACE FUNCTION public.handle_commission_refund_atomic(
    p_order_id VARCHAR(255),
    p_refund_key VARCHAR(255),
    p_refund_amount NUMERIC(20, 2)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record RECORD;
    v_prev_refund_sum NUMERIC(20, 2);
    v_snap JSONB;
    v_cumulative_refund_amount NUMERIC(20, 2);
    v_remaining_ratio NUMERIC;
    v_target_remaining INTEGER;
    v_target_cumulative_clawback INTEGER;
    v_delta_reversal INTEGER;
    v_new_cumulative_reversed INTEGER;
    v_new_remaining_payable INTEGER;
    v_new_status VARCHAR(50);
    v_cancel_reason VARCHAR(255);
    v_reversed_at TIMESTAMPTZ;
    v_snapshot_entry JSONB;
    v_updated_snapshots JSONB;
    v_processed_count INTEGER := 0;
    v_total_delta_reversed INTEGER := 0;
    v_record_results JSONB[] := ARRAY[]::jsonb[];
BEGIN
    -- Input Sanity Check
    IF p_order_id IS NULL OR p_order_id = '' OR p_refund_key IS NULL OR p_refund_key = '' OR p_refund_amount IS NULL OR p_refund_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'INVALID_ARGUMENTS',
            'message', 'orderId, refundKey, and a positive refundAmount are required.'
        );
    END IF;

    -- A. Acquire transactional row lock FOR UPDATE on matching commission records
    -- Processes all records matching order_id in a single transaction
    FOR v_record IN 
        SELECT * 
        FROM public.commission_records 
        WHERE order_id = p_order_id
        FOR UPDATE
    LOOP
        -- B. Idempotency Guard: Skip if this specific refundKey has already been processed for this record
        IF v_record.reversal_snapshots @> jsonb_build_array(jsonb_build_object('refundKey', p_refund_key)) THEN
            v_record_results := array_append(v_record_results, jsonb_build_object(
                'commissionId', v_record.id,
                'recipientId', v_record.recipient_id,
                'previousStatus', v_record.status,
                'newStatus', v_record.status,
                'deltaReversal', 0,
                'cumulativeReversed', v_record.cumulative_reversed_amount,
                'remainingPayable', v_record.remaining_payable_amount,
                'alreadyProcessed', true
            ));
            CONTINUE;
        END IF;

        -- C. Sum all previously recorded refund amounts in reversal_snapshots array
        v_prev_refund_sum := 0;
        IF v_record.reversal_snapshots IS NOT NULL AND jsonb_typeof(v_record.reversal_snapshots) = 'array' THEN
            FOR v_snap IN SELECT * FROM jsonb_array_elements(v_record.reversal_snapshots) LOOP
                v_prev_refund_sum := v_prev_refund_sum + COALESCE((v_snap->>'refundAmount')::numeric, 0);
            END LOOP;
        END IF;

        -- Cumulative refund amount includes previous refunds + current refund amount
        v_cumulative_refund_amount := v_prev_refund_sum + p_refund_amount;

        -- Selling price snapshot must be positive to prevent division by zero
        IF v_record.selling_price_snapshot <= 0 THEN
            v_record_results := array_append(v_record_results, jsonb_build_object(
                'commissionId', v_record.id,
                'skipped', true,
                'reason', 'INVALID_SELLING_PRICE_SNAPSHOT'
            ));
            CONTINUE;
        END IF;

        -- D. Core Commission Clawback Math (Perfect parity with CommissionService.ts)
        -- TargetRemaining = round( C * max(0, S - cumulativeRefundAmount) / S )
        v_remaining_ratio := GREATEST(0, v_record.selling_price_snapshot - v_cumulative_refund_amount) / v_record.selling_price_snapshot;
        v_target_remaining := GREATEST(0, ROUND(v_record.commission_amount * v_remaining_ratio))::integer;
        v_target_cumulative_clawback := GREATEST(0, LEAST(v_record.commission_amount, v_record.commission_amount - v_target_remaining))::integer;

        -- Delta clawback to be reversed in this step
        v_delta_reversal := GREATEST(0, LEAST(v_record.commission_amount - v_record.cumulative_reversed_amount, v_target_cumulative_clawback - v_record.cumulative_reversed_amount))::integer;
        v_new_cumulative_reversed := v_record.cumulative_reversed_amount + v_delta_reversal;
        v_new_remaining_payable := GREATEST(0, v_record.commission_amount - v_new_cumulative_reversed);

        -- E. Determine Status and Audit Fields
        IF v_new_remaining_payable = 0 THEN
            v_new_status := 'CANCELLED';
            v_cancel_reason := 'CANCELLED_BY_REFUND';
            v_reversed_at := now();
        ELSE
            v_new_status := v_record.status;
            v_cancel_reason := v_record.cancel_reason;
            v_reversed_at := v_record.reversed_at;
        END IF;

        -- F. Construct reversal snapshot entry
        v_snapshot_entry := jsonb_build_object(
            'refundKey', p_refund_key,
            'refundAmount', p_refund_amount,
            'deltaReversedCommission', v_delta_reversal,
            'cumulativeReversedCommission', v_new_cumulative_reversed,
            'remainingPayableCommission', v_new_remaining_payable,
            'ledgerJournalId', CASE WHEN v_delta_reversal > 0 THEN 'ledger_commission_reversal_' || v_record.id || '_' || p_refund_key ELSE NULL END,
            'reversedAt', to_jsonb(now())
        );

        -- Append to reversal_snapshots array
        IF v_record.reversal_snapshots IS NULL OR jsonb_typeof(v_record.reversal_snapshots) != 'array' THEN
            v_updated_snapshots := jsonb_build_array(v_snapshot_entry);
        ELSE
            v_updated_snapshots := v_record.reversal_snapshots || v_snapshot_entry;
        END IF;

        -- G. Perform Atomic Database Update
        UPDATE public.commission_records SET
            status = v_new_status,
            cancel_reason = v_cancel_reason,
            cumulative_reversed_amount = v_new_cumulative_reversed,
            remaining_payable_amount = v_new_remaining_payable,
            reversal_snapshots = v_updated_snapshots,
            reversed_at = v_reversed_at,
            updated_at = now()
        WHERE id = v_record.id;

        -- Update transactional accumulator
        v_processed_count := v_processed_count + 1;
        v_total_delta_reversed := v_total_delta_reversed + v_delta_reversal;

        v_record_results := array_append(v_record_results, jsonb_build_object(
            'commissionId', v_record.id,
            'recipientId', v_record.recipient_id,
            'previousStatus', v_record.status,
            'newStatus', v_new_status,
            'deltaReversal', v_delta_reversal,
            'cumulativeReversed', v_new_cumulative_reversed,
            'remainingPayable', v_new_remaining_payable,
            'alreadyProcessed', false
        ));
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'orderId', p_order_id,
        'refundKey', p_refund_key,
        'refundAmount', p_refund_amount,
        'processedRecordsCount', v_processed_count,
        'totalDeltaReversed', v_total_delta_reversed,
        'results', to_jsonb(v_record_results)
    );
END;
$$;

-- 2. Access Control & Permission Enforcement
REVOKE ALL ON FUNCTION public.handle_commission_refund_atomic(VARCHAR(255), VARCHAR(255), NUMERIC(20, 2)) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.handle_commission_refund_atomic(VARCHAR(255), VARCHAR(255), NUMERIC(20, 2)) TO service_role;
