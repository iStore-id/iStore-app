-- 1. Create Tracking Tables for Atomicity & Idempotency
CREATE TABLE IF NOT EXISTS public.reservations (
  id TEXT PRIMARY KEY,
  variant_id VARCHAR NOT NULL,
  quantity INT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on reservations table (restrict directly to service_role with no public CRUD policies)
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.promo_usage_tracking (
  order_id TEXT PRIMARY KEY,
  promo_id UUID NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flash_sale_usage_tracking (
  order_id TEXT PRIMARY KEY,
  flash_sale_id UUID NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_promo_usage_user ON public.promo_usage_tracking(user_id, promo_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_usage_user ON public.flash_sale_usage_tracking(user_id, flash_sale_id);

-- 2. Atomic Promo Usage Increment RPC
CREATE OR REPLACE FUNCTION public.atomic_increment_promo_usage(
  p_promo_id UUID,
  p_user_id UUID,
  p_order_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_usage_count INT;
  v_usage_limit INT;
  v_per_customer_limit INT;
  v_customer_usage INT;
  v_already_tracked BOOLEAN;
BEGIN
  -- A. Idempotency Check
  SELECT EXISTS(SELECT 1 FROM public.promo_usage_tracking WHERE order_id = p_order_id) INTO v_already_tracked;
  IF v_already_tracked THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- B. Concurrency Lock per Customer + Promo
  IF p_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('promo_limit'), hashtext(p_promo_id::text || p_user_id::text));
  END IF;

  -- C. Lock Global Promo row
  SELECT usage_count, usage_limit, per_customer_usage_limit 
  INTO v_usage_count, v_usage_limit, v_per_customer_limit
  FROM public.promos 
  WHERE id = p_promo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROMO_NOT_FOUND');
  END IF;

  -- D. Check Global Limit
  IF v_usage_limit IS NOT NULL AND v_usage_count >= v_usage_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROMO_QUOTA_EXCEEDED');
  END IF;

  -- E. Check Per-Customer Limit
  IF v_per_customer_limit IS NOT NULL AND p_user_id IS NOT NULL THEN
    -- Count from both orders and tracking table to catch all usages
    SELECT COUNT(DISTINCT usage_id) INTO v_customer_usage
    FROM (
      SELECT id as usage_id FROM public.orders 
      WHERE user_id = p_user_id AND promo_id = p_promo_id AND payment_status IN ('paid', 'pending', 'settlement', 'capture') AND id != p_order_id
      UNION
      SELECT order_id as usage_id FROM public.promo_usage_tracking 
      WHERE user_id = p_user_id AND promo_id = p_promo_id AND order_id != p_order_id
    ) combined_usage;
    
    IF v_customer_usage >= v_per_customer_limit THEN
      RETURN jsonb_build_object('success', false, 'error', 'PROMO_PER_CUSTOMER_LIMIT_REACHED');
    END IF;
  END IF;

  -- F. Increment Global Count
  UPDATE public.promos 
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = p_promo_id;

  -- G. Record Tracking
  INSERT INTO public.promo_usage_tracking (order_id, promo_id, user_id) 
  VALUES (p_order_id, p_promo_id, p_user_id);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 3. Atomic Flash Sale Consumption RPC
CREATE OR REPLACE FUNCTION public.atomic_consume_flash_sale_quota(
  p_flash_sale_id UUID,
  p_user_id UUID,
  p_order_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_remaining_quota INT;
  v_per_customer_limit INT;
  v_customer_usage INT;
  v_already_tracked BOOLEAN;
BEGIN
  -- A. Idempotency Check
  SELECT EXISTS(SELECT 1 FROM public.flash_sale_usage_tracking WHERE order_id = p_order_id) INTO v_already_tracked;
  IF v_already_tracked THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- B. Concurrency Lock per Customer + Flash Sale
  IF p_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('fs_limit'), hashtext(p_flash_sale_id::text || p_user_id::text));
  END IF;

  -- C. Lock Global Flash Sale row
  SELECT remaining_quota, per_customer_limit 
  INTO v_remaining_quota, v_per_customer_limit
  FROM public.flash_sales 
  WHERE id = p_flash_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FLASH_SALE_NOT_FOUND');
  END IF;

  -- D. Check Global Quota
  IF v_remaining_quota IS NOT NULL AND v_remaining_quota <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'FLASH_SALE_QUOTA_EXCEEDED');
  END IF;

  -- E. Check Per-Customer Limit
  IF v_per_customer_limit IS NOT NULL AND p_user_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT usage_id) INTO v_customer_usage
    FROM (
      SELECT id as usage_id FROM public.orders 
      WHERE user_id = p_user_id AND (flash_sale_snapshot->>'id')::TEXT = p_flash_sale_id::TEXT AND payment_status IN ('paid', 'pending', 'settlement', 'capture') AND id != p_order_id
      UNION
      SELECT order_id as usage_id FROM public.flash_sale_usage_tracking 
      WHERE user_id = p_user_id AND flash_sale_id = p_flash_sale_id AND order_id != p_order_id
    ) combined_usage;
    
    IF v_customer_usage >= v_per_customer_limit THEN
      RETURN jsonb_build_object('success', false, 'error', 'FLASH_SALE_PER_CUSTOMER_LIMIT_REACHED');
    END IF;
  END IF;

  -- F. Update Global Quota & Usage
  UPDATE public.flash_sales 
  SET remaining_quota = CASE WHEN remaining_quota IS NOT NULL THEN remaining_quota - 1 ELSE NULL END,
      usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = p_flash_sale_id;

  -- G. Record Tracking
  INSERT INTO public.flash_sale_usage_tracking (order_id, flash_sale_id, user_id) 
  VALUES (p_order_id, p_flash_sale_id, p_user_id);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 4. Atomic Promo Usage Release RPC
CREATE OR REPLACE FUNCTION public.atomic_release_promo_usage(
  p_order_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_promo_id UUID;
BEGIN
  -- 1. Check if tracking entry exists (Idempotency)
  SELECT promo_id INTO v_promo_id
  FROM public.promo_usage_tracking
  WHERE order_id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'NO_USAGE_TO_RELEASE');
  END IF;

  -- 2. Lock promo row
  PERFORM 1 FROM public.promos WHERE id = v_promo_id FOR UPDATE;

  -- 3. Decrement usage
  UPDATE public.promos 
  SET usage_count = GREATEST(0, usage_count - 1),
      updated_at = NOW()
  WHERE id = v_promo_id;

  -- 4. Delete tracking
  DELETE FROM public.promo_usage_tracking WHERE order_id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 5. Atomic Flash Sale Quota Release RPC
CREATE OR REPLACE FUNCTION public.atomic_release_flash_sale_quota(
  p_order_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_flash_sale_id UUID;
BEGIN
  -- 1. Check if tracking entry exists (Idempotency)
  SELECT flash_sale_id INTO v_flash_sale_id
  FROM public.flash_sale_usage_tracking
  WHERE order_id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'NO_QUOTA_TO_RELEASE');
  END IF;

  -- 2. Lock flash sale row
  PERFORM 1 FROM public.flash_sales WHERE id = v_flash_sale_id FOR UPDATE;

  -- 3. Increment remaining quota and decrement usage count
  UPDATE public.flash_sales 
  SET remaining_quota = CASE WHEN remaining_quota IS NOT NULL THEN remaining_quota + 1 ELSE NULL END,
      usage_count = GREATEST(0, usage_count - 1),
      updated_at = NOW()
  WHERE id = v_flash_sale_id;

  -- 4. Delete tracking
  DELETE FROM public.flash_sale_usage_tracking WHERE order_id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 6. Atomic Stock Reservation RPC
CREATE OR REPLACE FUNCTION public.atomic_reserve_stock(
  p_order_id TEXT,
  p_variant_id VARCHAR,
  p_quantity INT
) RETURNS JSONB AS $$
DECLARE
  v_stock_id UUID;
  v_available_quantity INT;
  v_reserved_quantity INT;
  v_existing_variant_id VARCHAR;
  v_existing_quantity INT;
BEGIN
  -- A. Validate inputs
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_QUANTITY');
  END IF;

  -- B. Acquire transaction-level advisory lock on p_order_id to serialize concurrent identical requests
  PERFORM pg_advisory_xact_lock(hashtext('reservation_lock'), hashtext(p_order_id));

  -- 1. Check if reservation already exists
  SELECT variant_id, quantity INTO v_existing_variant_id, v_existing_quantity
  FROM public.reservations
  WHERE id = p_order_id
  FOR UPDATE;

  -- 2. Handle existing reservation
  IF FOUND THEN
    IF v_existing_variant_id = p_variant_id AND v_existing_quantity = p_quantity THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'RESERVATION_CONFLICT');
    END IF;
  END IF;

  -- 3. No reservation exists, lock/check stock row
  SELECT id, available_quantity, reserved_quantity INTO v_stock_id, v_available_quantity, v_reserved_quantity
  FROM public.stocks
  WHERE variant_id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'STOCK_NOT_FOUND');
  END IF;

  IF v_available_quantity < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_STOCK');
  END IF;

  -- Update stock counters
  UPDATE public.stocks 
  SET reserved_quantity = reserved_quantity + p_quantity,
      available_quantity = available_quantity - p_quantity,
      updated_at = NOW()
  WHERE id = v_stock_id;

  -- Insert reservation
  INSERT INTO public.reservations (id, variant_id, quantity, expires_at, created_at)
  VALUES (p_order_id, p_variant_id, p_quantity, NOW() + INTERVAL '15 minutes', NOW());

  -- Record stock movement
  INSERT INTO public.stock_movements (id, variant_id, type, quantity, before_quantity, after_quantity, reference_id, reason, created_at)
  VALUES (gen_random_uuid(), p_variant_id, 'RESERVE', p_quantity, v_available_quantity, v_available_quantity - p_quantity, p_order_id, 'RESERVE', NOW());

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
