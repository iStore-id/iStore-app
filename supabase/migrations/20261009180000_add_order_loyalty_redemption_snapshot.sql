-- Persist the loyalty redemption snapshot used to calculate each checkout total.
-- Safe to re-run and preserves existing orders with zero-valued defaults.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_points_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_discount_amount bigint NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_loyalty_points_used_nonnegative_check,
  ADD CONSTRAINT orders_loyalty_points_used_nonnegative_check
    CHECK (loyalty_points_used >= 0);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_loyalty_discount_amount_nonnegative_check,
  ADD CONSTRAINT orders_loyalty_discount_amount_nonnegative_check
    CHECK (loyalty_discount_amount >= 0);
