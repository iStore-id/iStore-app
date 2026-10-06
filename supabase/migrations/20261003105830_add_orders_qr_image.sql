-- Migration: Reconstructed from Production Schema.
-- Purpose: Add QR image storage to orders.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qr_image TEXT;
