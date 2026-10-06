-- Migration: Reconstructed from Production Schema.
-- Purpose: Grant necessary schema-access privileges to service_role on game_categories.

GRANT ALL ON TABLE public.game_categories TO service_role;
