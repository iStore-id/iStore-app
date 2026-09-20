-- Migration: Create transition_order_state_v1 for Supabase Orders State Machine
-- Author: AI Assistant
-- Date: 2026-09-10

CREATE OR REPLACE FUNCTION public.transition_order_state_v1(
  p_order_id VARCHAR,
  p_new_state VARCHAR,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_reason TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_row public.orders%ROWTYPE;
  v_updated_row public.orders%ROWTYPE;
  
  -- Use dynamic column types from public.orders schema
  v_p_status public.orders.payment_status%TYPE;
  v_t_status public.orders.transaction_status%TYPE;
  v_target_payment_status public.orders.payment_status%TYPE;
  v_target_transaction_status public.orders.transaction_status%TYPE;
  v_paid_at public.orders.paid_at%TYPE;
  v_fulfilled_at public.orders.fulfilled_at%TYPE;
  
  v_current_logical_state VARCHAR;
  v_is_transition_valid BOOLEAN := FALSE;
  
  -- Extract variables
  v_provider_reference_id VARCHAR;
  v_serial_number VARCHAR;
  v_failure_reason VARCHAR;
  v_snap_token VARCHAR;
  v_payment_url VARCHAR;
  v_gateway_transaction_id VARCHAR;
  v_gateway_payment_type VARCHAR;
  v_gateway_response JSONB;
  v_fulfillment_response JSONB;
  
  -- Return variables
  v_order_before JSONB;
  v_order_after JSONB;
BEGIN
  -- 1. Pessimistic locking of the order row
  SELECT * INTO v_order_row 
  FROM public.orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  -- 2. Check if order exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error_message', 'ORDER_NOT_FOUND',
      'order_before', NULL,
      'order_after', NULL
    );
  END IF;

  -- Keep record of the order before modification
  v_order_before := row_to_json(v_order_row)::jsonb;

  -- 3. Determine current logical state safely casting enums to text
  v_p_status := COALESCE(v_order_row.payment_status, 'pending');
  v_t_status := COALESCE(v_order_row.transaction_status, 'pending');

  IF v_p_status::text = 'failed' OR v_t_status::text = 'failed' THEN
    v_current_logical_state := 'FAILED';
  ELSIF v_p_status::text = 'expired' THEN
    v_current_logical_state := 'EXPIRED';
  ELSIF v_p_status::text = 'pending' THEN
    v_current_logical_state := 'PENDING_PAYMENT';
  ELSIF v_p_status::text IN ('settlement', 'capture') THEN
    IF v_t_status::text = 'success' THEN
      v_current_logical_state := 'SUCCESS';
    ELSIF v_t_status::text = 'processing' THEN
      v_current_logical_state := 'PROCESSING';
    ELSE
      v_current_logical_state := 'PAID';
    END IF;
  ELSE
    v_current_logical_state := 'PENDING_PAYMENT'; -- Fallback
  END IF;

  -- 4. Validate transition using VALID_TRANSITIONS rules
  IF v_current_logical_state = 'PENDING_PAYMENT' AND p_new_state IN ('PAID', 'EXPIRED', 'FAILED') THEN
    v_is_transition_valid := TRUE;
  ELSIF v_current_logical_state = 'PAID' AND p_new_state IN ('PROCESSING', 'FAILED') THEN
    v_is_transition_valid := TRUE;
  ELSIF v_current_logical_state = 'PROCESSING' AND p_new_state IN ('SUCCESS', 'FAILED') THEN
    v_is_transition_valid := TRUE;
  END IF;

  IF NOT v_is_transition_valid THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error_message', 'INVALID_STATE_TRANSITION',
      'order_before', v_order_before,
      'order_after', NULL
    );
  END IF;

  -- 5. Determine target payment and transaction status
  v_target_payment_status := v_order_row.payment_status;
  v_target_transaction_status := v_order_row.transaction_status;

  IF p_new_state = 'PAID' THEN
    v_target_payment_status := 'settlement';
  ELSIF p_new_state = 'EXPIRED' THEN
    v_target_payment_status := 'expired';
  ELSIF p_new_state = 'PROCESSING' THEN
    v_target_transaction_status := 'processing';
  ELSIF p_new_state = 'SUCCESS' THEN
    v_target_transaction_status := 'success';
  ELSIF p_new_state = 'FAILED' THEN
    IF v_current_logical_state = 'PENDING_PAYMENT' THEN
      v_target_payment_status := 'failed';
    ELSE
      v_target_transaction_status := 'failed';
    END IF;
  END IF;

  -- 6. Extract fields from p_payload supporting both camelCase and snake_case
  IF p_payload ? 'providerReference' OR p_payload ? 'providerReferenceId' OR p_payload ? 'provider_reference_id' THEN
    v_provider_reference_id := COALESCE(
      p_payload->>'providerReferenceId',
      p_payload->>'providerReference',
      p_payload->>'provider_reference_id'
    );
  ELSE
    v_provider_reference_id := v_order_row.provider_reference_id;
  END IF;

  IF p_payload ? 'serialNumber' OR p_payload ? 'serial_number' THEN
    v_serial_number := COALESCE(p_payload->>'serialNumber', p_payload->>'serial_number');
  ELSE
    v_serial_number := v_order_row.serial_number;
  END IF;

  IF p_payload ? 'failureReason' OR p_payload ? 'failure_reason' THEN
    v_failure_reason := COALESCE(p_payload->>'failureReason', p_payload->>'failure_reason');
  ELSE
    v_failure_reason := v_order_row.failure_reason;
  END IF;

  IF p_payload ? 'snapToken' OR p_payload ? 'snap_token' THEN
    v_snap_token := COALESCE(p_payload->>'snapToken', p_payload->>'snap_token');
  ELSE
    v_snap_token := v_order_row.snap_token;
  END IF;

  IF p_payload ? 'paymentUrl' OR p_payload ? 'payment_url' THEN
    v_payment_url := COALESCE(p_payload->>'paymentUrl', p_payload->>'payment_url');
  ELSE
    v_payment_url := v_order_row.payment_url;
  END IF;

  IF p_payload ? 'gatewayTransactionId' OR p_payload ? 'gateway_transaction_id' THEN
    v_gateway_transaction_id := COALESCE(p_payload->>'gatewayTransactionId', p_payload->>'gateway_transaction_id');
  ELSE
    v_gateway_transaction_id := v_order_row.gateway_transaction_id;
  END IF;

  IF p_payload ? 'gatewayPaymentType' OR p_payload ? 'gateway_payment_type' THEN
    v_gateway_payment_type := COALESCE(p_payload->>'gatewayPaymentType', p_payload->>'gateway_payment_type');
  ELSE
    v_gateway_payment_type := v_order_row.gateway_payment_type;
  END IF;

  IF p_payload ? 'gatewayResponse' OR p_payload ? 'gateway_response' THEN
    v_gateway_response := COALESCE(p_payload->'gatewayResponse', p_payload->'gateway_response');
  ELSE
    v_gateway_response := v_order_row.gateway_response;
  END IF;

  -- Set special native timestamptz fields safely
  IF p_new_state = 'PAID' THEN
    IF p_payload ? 'paidAt' OR p_payload ? 'paid_at' THEN
      v_paid_at := COALESCE(NULLIF(p_payload->>'paidAt', ''), NULLIF(p_payload->>'paid_at', ''))::timestamptz;
    ELSE
      v_paid_at := NOW();
    END IF;
  ELSE
    IF p_payload ? 'paidAt' OR p_payload ? 'paid_at' THEN
      v_paid_at := COALESCE(NULLIF(p_payload->>'paidAt', ''), NULLIF(p_payload->>'paid_at', ''))::timestamptz;
    ELSE
      v_paid_at := v_order_row.paid_at;
    END IF;
  END IF;

  IF p_new_state = 'SUCCESS' THEN
    IF p_payload ? 'fulfilledAt' OR p_payload ? 'fulfilled_at' THEN
      v_fulfilled_at := COALESCE(NULLIF(p_payload->>'fulfilledAt', ''), NULLIF(p_payload->>'fulfilled_at', ''))::timestamptz;
    ELSE
      v_fulfilled_at := NOW();
    END IF;
  ELSE
    IF p_payload ? 'fulfilledAt' OR p_payload ? 'fulfilled_at' THEN
      v_fulfilled_at := COALESCE(NULLIF(p_payload->>'fulfilledAt', ''), NULLIF(p_payload->>'fulfilled_at', ''))::timestamptz;
    ELSE
      v_fulfilled_at := v_order_row.fulfilled_at;
    END IF;
  END IF;

  -- Merge only p_payload.fulfillmentResponse or p_payload.fulfillment_response into fulfillment_response if provided
  IF p_payload ? 'fulfillmentResponse' OR p_payload ? 'fulfillment_response' THEN
    v_fulfillment_response := COALESCE(v_order_row.fulfillment_response, '{}'::jsonb) || 
                              COALESCE(p_payload->'fulfillmentResponse', p_payload->'fulfillment_response', '{}'::jsonb);
  ELSE
    v_fulfillment_response := v_order_row.fulfillment_response;
  END IF;

  -- 7. Execute update
  UPDATE public.orders 
  SET 
    payment_status = v_target_payment_status,
    transaction_status = v_target_transaction_status,
    provider_reference_id = v_provider_reference_id,
    serial_number = v_serial_number,
    failure_reason = v_failure_reason,
    snap_token = v_snap_token,
    payment_url = v_payment_url,
    gateway_transaction_id = v_gateway_transaction_id,
    gateway_payment_type = v_gateway_payment_type,
    gateway_response = v_gateway_response,
    paid_at = v_paid_at,
    fulfilled_at = v_fulfilled_at,
    fulfillment_response = v_fulfillment_response,
    updated_at = NOW()
  WHERE id = p_order_id
  RETURNING * INTO v_updated_row;

  v_order_after := row_to_json(v_updated_row)::jsonb;

  RETURN jsonb_build_object(
    'success', TRUE,
    'error_message', NULL,
    'order_before', v_order_before,
    'order_after', v_order_after
  );
END;
$$;
