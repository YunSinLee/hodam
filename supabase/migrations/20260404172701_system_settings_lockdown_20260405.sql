BEGIN;

ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_settings_no_access_auth ON public.system_settings;
DROP POLICY IF EXISTS system_settings_no_access_anon ON public.system_settings;

CREATE POLICY system_settings_no_access_auth ON public.system_settings
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY system_settings_no_access_anon ON public.system_settings
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

COMMIT;
