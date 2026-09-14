BEGIN;

ALTER TABLE IF EXISTS public.payment_webhook_transmissions
  DISABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_webhook_transmissions FROM PUBLIC;
REVOKE ALL ON TABLE public.payment_webhook_transmissions FROM anon;
REVOKE ALL ON TABLE public.payment_webhook_transmissions FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.payment_webhook_transmissions TO service_role;

COMMIT;
