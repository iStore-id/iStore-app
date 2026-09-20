-- Additive Remediation Migration for Ledger Chart of Accounts
-- Ensures all 10 canonical accounts exist and have correct metadata

INSERT INTO public.ledger_accounts (id, name, classification, normal_balance) VALUES
('1000', 'Payment Gateway Receivable', 'ASSET', 'DEBIT'),
('1100', 'Bank Clearing', 'ASSET', 'DEBIT'),
('1200', 'Primary Bank Account', 'ASSET', 'DEBIT'),
('2000', 'Customer Unearned Revenue', 'LIABILITY', 'CREDIT'),
('2100', 'Commission Payable', 'LIABILITY', 'CREDIT'),
('4000', 'Gross Sales Revenue', 'REVENUE', 'CREDIT'),
('4100', 'Sales Refund Contra', 'REVENUE', 'DEBIT'),
('5000', 'Gateway MDR Fee', 'EXPENSE', 'DEBIT'),
('5100', 'Settlement Adjustment', 'EXPENSE', 'DEBIT'),
('5200', 'Commission Expense', 'EXPENSE', 'DEBIT')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  classification = EXCLUDED.classification,
  normal_balance = EXCLUDED.normal_balance;

-- Ensure RLS is active for the table
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ledger_accounts TO authenticated;
GRANT SELECT ON public.ledger_accounts TO anon;
GRANT SELECT ON public.ledger_accounts TO service_role;
