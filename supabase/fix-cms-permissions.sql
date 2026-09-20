-- FIX: Grant permissions to service_role for CMS/Marketing tables
-- This resolves the "permission denied" error encountered by the backend repositories.

-- 1. Ensure service_role can use the public schema
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Grant full CRUD permissions to service_role for all CMS tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_library TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.banners TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.popups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.faqs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blogs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.landings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campaigns TO service_role;

-- 3. Ensure sequence permissions if any SERIAL/IDENTITY columns exist (for INSERT)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. Public Read Access (Optional but recommended for RLS evaluation)
GRANT SELECT ON TABLE public.media_library TO anon, authenticated;
GRANT SELECT ON TABLE public.banners TO anon, authenticated;
GRANT SELECT ON TABLE public.popups TO anon, authenticated;
GRANT SELECT ON TABLE public.faqs TO anon, authenticated;
GRANT SELECT ON TABLE public.blogs TO anon, authenticated;
GRANT SELECT ON TABLE public.landings TO anon, authenticated;
GRANT SELECT ON TABLE public.campaigns TO anon, authenticated;
