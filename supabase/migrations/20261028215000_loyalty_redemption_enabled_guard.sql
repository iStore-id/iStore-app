-- Guard point redemptions at the database boundary so disabling Poin & Loyalty
-- cannot be bypassed by a direct RPC call or a concurrent config change.
CREATE OR REPLACE FUNCTION public.guard_loyalty_redemption_enabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  IF NEW.type = 'REDEEM' THEN
    SELECT enabled INTO v_enabled
    FROM public.loyalty_configs
    WHERE id = 'main';

    -- Match the existing service default when no config row has been created yet.
    IF FOUND AND NOT COALESCE(v_enabled, false) THEN
      RAISE EXCEPTION 'Sistem loyalty sedang tidak aktif.' USING ERRCODE = 'P0006';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_loyalty_redemption_enabled ON public.point_transactions;
CREATE TRIGGER trg_guard_loyalty_redemption_enabled
BEFORE INSERT ON public.point_transactions
FOR EACH ROW
EXECUTE FUNCTION public.guard_loyalty_redemption_enabled();

REVOKE ALL ON FUNCTION public.guard_loyalty_redemption_enabled() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_loyalty_redemption_enabled() TO service_role;
