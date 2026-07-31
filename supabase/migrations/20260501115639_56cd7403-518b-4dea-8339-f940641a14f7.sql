
-- Revoke EXECUTE on every SECURITY DEFINER function in public from anon
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public', r.nspname, r.proname, r.args);
  END LOOP;
END$$;

-- Restrict anon listing on branding buckets (object public reads via signed/public URL still work)
DROP POLICY IF EXISTS "Public read system-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read email-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view system-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view email-assets" ON storage.objects;
DROP POLICY IF EXISTS "system-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "email-assets public read" ON storage.objects;
