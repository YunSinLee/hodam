-- Disposable PostgreSQL fixture. Contains no production data or credentials.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE TABLE public.bead (user_id uuid PRIMARY KEY, count integer DEFAULT 10 CHECK (count >= 0));
CREATE TABLE public.bead_transactions (id bigserial PRIMARY KEY, user_id uuid, amount bigint, transaction_type text, description text, request_id text, UNIQUE(user_id, request_id));
CREATE TABLE public.user_activity_logs (user_id uuid, action text, details jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.thread (id bigserial PRIMARY KEY, user_id uuid, openai_thread_id text);
CREATE TABLE public.payment_history (id uuid, user_id uuid);
CREATE TABLE public.payment_webhook_transmissions (id uuid);
ALTER TABLE public.bead ENABLE ROW LEVEL SECURITY;
CREATE POLICY bead_insert_own ON public.bead FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY bead_select_own ON public.bead FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT ON public.bead TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_history TO authenticated;
-- These stubs are used only to assert function privileges; payment behavior is
-- covered by payment.test.ts and the existing production finalize implementation.
CREATE FUNCTION public.credit_beads(uuid, integer) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
CREATE FUNCTION public.finalize_payment(text, text, uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;
INSERT INTO public.bead VALUES ('11111111-1111-4111-8111-111111111111', 10), ('22222222-2222-4222-8222-222222222222', 10);

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (bucket_id text, name text, metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON public.thread TO authenticated;
INSERT INTO storage.buckets VALUES ('image', 'image', true, null, null);
CREATE POLICY "auth 1nq2cb_0" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'image');
CREATE POLICY "auth 1nq2cb_1" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'image');
CREATE POLICY "auth 1nq2cb_2" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'image');
CREATE POLICY "auth 1nq2cb_3" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'image');
INSERT INTO public.thread(id, user_id, openai_thread_id) VALUES
  (101, '11111111-1111-4111-8111-111111111111', 'picturebook_storage1'),
  (202, '22222222-2222-4222-8222-222222222222', 'picturebook_storage2');
INSERT INTO storage.objects VALUES ('image','image_thread_id_101_page_1',null), ('image','image_thread_id_202_page_1',null);
