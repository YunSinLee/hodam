-- Missing structures in the disposable minimal DB, not production DDL.
ALTER TABLE public.payment_webhook_transmissions
  ADD COLUMN transmission_id text PRIMARY KEY,
  ADD COLUMN order_id text,
  ADD COLUMN event_type text,
  ADD COLUMN transmission_time timestamptz,
  ADD COLUMN retried_count integer NOT NULL DEFAULT 0,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payment_history ADD COLUMN order_id text;

CREATE TABLE public.users (
  id uuid PRIMARY KEY, email text, display_name text,
  created_at timestamptz, updated_at timestamptz DEFAULT now()
);
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Existing trigger body from 20260404172619_rls_policy_cleanup_20260405.sql.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  INSERT INTO public.users (id, email, display_name, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User_' || substr(NEW.id::text, 1, 8)), NEW.created_at)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, users.display_name), updated_at = now();
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Simulate the old broad grants, including explicit role grants that revoking
-- PUBLIC alone does not remove. Test-only INSERT verifies trigger continuity.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
GRANT INSERT ON auth.users TO authenticated;
