-- Persistent storage for Owner-managed privacy and legal settings.
CREATE TABLE IF NOT EXISTS public.privacy (
  id text PRIMARY KEY,
  "privacyPolicy" jsonb NOT NULL,
  "termsOfService" jsonb NOT NULL,
  "dpoContact" jsonb NOT NULL,
  "cookieConsent" jsonb NOT NULL,
  "dataRetention" jsonb NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "updatedBy" text NOT NULL DEFAULT 'system'
);

ALTER TABLE public.privacy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.privacy FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.privacy TO service_role;
