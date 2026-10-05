-- Migration: Atomic Inventory Reservation Expiry Cleanup
-- This function finds expired reservations and restores stock atomically.

CREATE OR REPLACE FUNCTION public.release_expired_reservations_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res_row RECORD;
  v_count INT := 0;
  v_results JSONB := jsonb_build_array();
BEGIN
  -- 1. Loop through expired reservations that are not yet processed
  -- Use FOR UPDATE SKIP LOCKED to handle concurrent worker attempts safely
  FOR v_res_row IN 
    SELECT * FROM public.reservations 
    WHERE expires_at < NOW() 
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 2. Restore stock for the variant
    UPDATE public.stocks 
    SET quantity = quantity + v_res_row.quantity,
        updated_at = NOW()
    WHERE variant_id = v_res_row.variant_id;

    -- 3. Record stock movement
    INSERT INTO public.stock_movements (id, stock_id, variant_id, delta, reason, reference_id, created_at)
    SELECT gen_random_uuid(), id, v_res_row.variant_id, v_res_row.quantity, 'EXPIRY_RELEASE', v_res_row.id, NOW()
    FROM public.stocks
    WHERE variant_id = v_res_row.variant_id;

    -- 4. Delete the reservation
    DELETE FROM public.reservations WHERE id = v_res_row.id;

    v_count := v_count + 1;
    v_results := v_results || jsonb_build_object('order_id', v_res_row.id, 'quantity', v_res_row.quantity);
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'processed_count', v_count,
    'details', v_results
  );
END;
$$;
