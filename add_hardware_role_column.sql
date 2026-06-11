-- ============================================================
-- Add role column to hardware_devices
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
-- The app stores printer roles (receipt, kitchen1, kitchen2, bar)
-- to distinguish printers beyond just type (receipt_printer /
-- kitchen_printer). Without this column the role reverts to the
-- default derived value on every page reload.

ALTER TABLE public.hardware_devices
  ADD COLUMN IF NOT EXISTS role text;

-- Back-fill existing rows from type so nothing breaks
UPDATE public.hardware_devices
   SET role = CASE type
                WHEN 'receipt_printer' THEN 'receipt'
                ELSE 'kitchen1'
              END
 WHERE role IS NULL;
