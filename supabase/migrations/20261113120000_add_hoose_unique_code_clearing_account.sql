-- Add a dedicated clearing liability for Hoose.id QRIS unique codes.
-- Additive migration only. Do not run automatically as part of application deploy.
-- Match the production ledger_accounts schema (id, code, name, type, normal_balance).
-- Existing account definitions are never overwritten: a conflicting 2200 account
-- causes a clear migration error and must be reviewed manually.

INSERT INTO public.ledger_accounts (id, code, name, type, normal_balance)
VALUES ('2200', '2200', 'Hoose Unique Code Clearing', 'LIABILITY', 'CREDIT')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_account public.ledger_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_account
  FROM public.ledger_accounts
  WHERE id = '2200';

  IF NOT FOUND
     OR v_account.code <> '2200'
     OR v_account.name <> 'Hoose Unique Code Clearing'
     OR v_account.type <> 'LIABILITY'
     OR v_account.normal_balance <> 'CREDIT'
     OR v_account.is_active IS NOT TRUE
  THEN
    RAISE EXCEPTION 'Ledger account 2200 already exists with a conflicting definition; review manually before enabling Hoose unique-code posting.';
  END IF;
END;
$$;
