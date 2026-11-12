-- Add a dedicated clearing liability for Hoose.id QRIS unique codes.
-- This migration is additive and is intentionally not executed by this change.
-- Unique codes are gateway-collected amounts outside the customer's product
-- liability; keep them separate until settlement/reconciliation policy is defined.

INSERT INTO public.ledger_accounts (id, name, classification, normal_balance)
VALUES ('2200', 'Hoose Unique Code Clearing', 'LIABILITY', 'CREDIT')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  classification = EXCLUDED.classification,
  normal_balance = EXCLUDED.normal_balance;
