-- Migration: commission_constraint_cleanup
-- Purpose: Cleanup legacy auto-named constraint references idempotently.

ALTER TABLE public.commission_recipients DROP CONSTRAINT IF EXISTS commission_recipients_code_key;
ALTER TABLE public.commission_recipients DROP CONSTRAINT IF EXISTS commission_recipients_user_id_fkey;
ALTER TABLE public.commission_rules DROP CONSTRAINT IF EXISTS commission_rules_recipient_id_fkey;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_order_id_fkey;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_recipient_id_fkey;
ALTER TABLE public.commission_records DROP CONSTRAINT IF EXISTS commission_records_rule_id_fkey;
