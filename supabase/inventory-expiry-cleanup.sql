-- Migration: Atomic Inventory Reservation Expiry Cleanup
-- This function finds expired reservations and restores stock atomically.

CREATE OR REPLACE FUNCTION public.release_expired_reservations_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res_row RECORD;
  v_count INT := 0;
  v_results JSONB := jsonb_build_array();
  v_stock_id UUID;
  v_reserved_quantity INT;
  v_available_quantity INT;
BEGIN
  -- 1. Loop through expired reservations that are not yet processed
  -- Use FOR UPDATE SKIP LOCKED to handle concurrent worker attempts safely
  FOR v_res_row IN 
    SELECT * FROM public.reservations 
    WHERE expires_at < NOW() 
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 2. Find and lock the corresponding stock row
    SELECT id, reserved_quantity, available_quantity 
    INTO v_stock_id, v_reserved_quantity, v_available_quantity
    FROM public.stocks 
    WHERE variant_id = v_res_row.variant_id 
    FOR UPDATE;

    -- 3. If no stock row exists, raise error to abort/retry safely
    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_ROW_NOT_FOUND_FOR_VARIANT: variant %', v_res_row.variant_id;
    END IF;

    -- 5. Prevent reserved_quantity from becoming negative
    IF v_reserved_quantity < v_res_row.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_RESERVED_QUANTITY_TO_RELEASE: variant %, reserved %, requested %', 
        v_res_row.variant_id, v_reserved_quantity, v_res_row.quantity;
    END IF;

    -- 4. Restore stock counters using the locked stock row
    UPDATE public.stocks 
    SET available_quantity = available_quantity + v_res_row.quantity,
        reserved_quantity = reserved_quantity - v_res_row.quantity,
        updated_at = NOW()
    WHERE id = v_stock_id;

    -- 6. Insert exactly one EXPIRE stock movement
    INSERT INTO public.stock_movements (id, variant_id, type, quantity, before_quantity, after_quantity, reference_id, reason, created_at)
    SELECT gen_random_uuid(), v_res_row.variant_id, 'EXPIRE', v_res_row.quantity, s.quantity, s.quantity, v_res_row.id, 'EXPIRY_RELEASE', NOW()
    FROM public.stocks s
    WHERE id = v_stock_id;

    -- 7. Only after success, delete the reservation
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

-- Explicitly lock down execution privileges for security hardening
REVOKE EXECUTE ON FUNCTION public.release_expired_reservations_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_expired_reservations_v1() TO service_role;
