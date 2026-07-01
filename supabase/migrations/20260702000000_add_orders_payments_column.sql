-- ============================================================
-- Add payments column to orders
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
-- The POS split-bill flow (handleCharge in src/pos/POS.jsx) reads and
-- writes an `orders.payments` jsonb array to track each partial payment
-- (e.g. [{method:"QRIS",amount:65000},{method:"Cash",amount:7000}]).
-- Without this column every split payment write fails silently (caught
-- and logged by dbWrite, never surfaced to the cashier), leaving the
-- order stuck at status "Open" with pay "-" no matter how many times
-- it's actually been paid.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payments jsonb DEFAULT '[]'::jsonb;
