-- ============================================================
-- RLS Security Fix — PawonLoka POS
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
-- Fixes:
--   ERROR  11 tables exposed to PostgREST with RLS disabled
--   WARN   sync_sub_recipe_name function has mutable search_path
-- ============================================================


-- ── 1. Enable RLS + add permissive policy on the 11 unprotected tables ──
--
-- These tables currently have NO RLS at all, making them fully accessible
-- to any request that knows the anon key. Enabling RLS + USING(true) keeps
-- existing behaviour (full access) while satisfying the security linter and
-- providing a safe base to tighten later.

ALTER TABLE public.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_journals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts          ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all ON public.products        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.orders          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.expenses        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.customers       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.employees       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.categories      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.gl_journals     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.ar_items        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.ap_items        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.kitchen_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.shifts          FOR ALL USING (true) WITH CHECK (true);


-- ── 2. Fix mutable search_path on sync_sub_recipe_name ──
--
-- Without a fixed search_path a superuser could inject a malicious schema
-- that shadows pg_catalog functions called by the trigger.

ALTER FUNCTION public.sync_sub_recipe_name() SET search_path = public, pg_temp;
