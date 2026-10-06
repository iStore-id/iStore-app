-- Migration: Rename legacy experimental ledger table to preserve historical data
-- Purpose: Resolve table collision with Phase 4E canonical double-entry ledger schema
-- Mode: Non-destructive, data-preserving, single-purpose DDL

ALTER TABLE public.ledger_entries
RENAME TO legacy_experimental_ledger_entries;
