BEGIN;

ALTER VIEW IF EXISTS public.kpi_daily
  SET (security_invoker = true);

ALTER VIEW IF EXISTS public.kpi_user_daily
  SET (security_invoker = true);

COMMIT;
