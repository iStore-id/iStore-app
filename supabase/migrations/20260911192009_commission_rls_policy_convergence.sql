-- Migration: commission_rls_policy_convergence
-- Purpose: Converge Row Level Security policies for commission tables.

ALTER TABLE public.commission_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;
