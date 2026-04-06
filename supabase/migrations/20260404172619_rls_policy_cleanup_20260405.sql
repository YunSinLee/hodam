BEGIN;

DROP INDEX IF EXISTS public.payment_history_order_id_unique;

CREATE INDEX IF NOT EXISTS bead_transactions_thread_id_idx
  ON public.bead_transactions (thread_id);

ALTER TABLE IF EXISTS public.bead ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bead_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.image ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "all authentication" ON public.image;
DROP POLICY IF EXISTS "All Authorization" ON public.keywords;
DROP POLICY IF EXISTS "All Authorization" ON public.messages;
DROP POLICY IF EXISTS "all authentication" ON public.selections;
DROP POLICY IF EXISTS "Allow read to all" ON public.thread;
DROP POLICY IF EXISTS "Allow insert to authenticated users" ON public.thread;
DROP POLICY IF EXISTS thread_modify_own ON public.thread;
DROP POLICY IF EXISTS thread_select_own ON public.thread;
DROP POLICY IF EXISTS messages_select_own ON public.messages;
DROP POLICY IF EXISTS payment_history_select_own ON public.payment_history;
DROP POLICY IF EXISTS "Allow read to all" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.users;
DROP POLICY IF EXISTS "All Authorization" ON public.bead;

DROP POLICY IF EXISTS thread_select_own ON public.thread;
DROP POLICY IF EXISTS thread_insert_own ON public.thread;
DROP POLICY IF EXISTS thread_update_own ON public.thread;
DROP POLICY IF EXISTS thread_delete_own ON public.thread;

DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

DROP POLICY IF EXISTS bead_select_own ON public.bead;

DROP POLICY IF EXISTS payment_history_select_own ON public.payment_history;

DROP POLICY IF EXISTS keywords_select_own ON public.keywords;
DROP POLICY IF EXISTS keywords_insert_own ON public.keywords;
DROP POLICY IF EXISTS keywords_update_own ON public.keywords;
DROP POLICY IF EXISTS keywords_delete_own ON public.keywords;

DROP POLICY IF EXISTS messages_select_own ON public.messages;
DROP POLICY IF EXISTS messages_insert_own ON public.messages;
DROP POLICY IF EXISTS messages_update_own ON public.messages;
DROP POLICY IF EXISTS messages_delete_own ON public.messages;

DROP POLICY IF EXISTS selections_select_own ON public.selections;
DROP POLICY IF EXISTS selections_insert_own ON public.selections;
DROP POLICY IF EXISTS selections_update_own ON public.selections;
DROP POLICY IF EXISTS selections_delete_own ON public.selections;

DROP POLICY IF EXISTS image_select_own ON public.image;
DROP POLICY IF EXISTS image_insert_own ON public.image;
DROP POLICY IF EXISTS image_update_own ON public.image;
DROP POLICY IF EXISTS image_delete_own ON public.image;

DROP POLICY IF EXISTS bead_transactions_select_own ON public.bead_transactions;
DROP POLICY IF EXISTS user_activity_logs_select_own ON public.user_activity_logs;

CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY bead_select_own ON public.bead
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY thread_select_own ON public.thread
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY thread_insert_own ON public.thread
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY thread_update_own ON public.thread
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY thread_delete_own ON public.thread
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY payment_history_select_own ON public.payment_history
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY keywords_select_own ON public.keywords
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = keywords.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY keywords_insert_own ON public.keywords
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = keywords.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY keywords_update_own ON public.keywords
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = keywords.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = keywords.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY keywords_delete_own ON public.keywords
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = keywords.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY messages_select_own ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = messages.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY messages_insert_own ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = messages.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY messages_update_own ON public.messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = messages.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = messages.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY messages_delete_own ON public.messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = messages.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY selections_select_own ON public.selections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = selections.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY selections_insert_own ON public.selections
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = selections.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY selections_update_own ON public.selections
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = selections.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = selections.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY selections_delete_own ON public.selections
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = selections.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY image_select_own ON public.image
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = image.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY image_insert_own ON public.image
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = image.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY image_update_own ON public.image
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = image.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = image.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY image_delete_own ON public.image
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.thread t
      WHERE t.id = image.thread_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY bead_transactions_select_own ON public.bead_transactions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_activity_logs_select_own ON public.user_activity_logs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.users (id, email, display_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      'User_' || substr(NEW.id::text, 1, 8)
    ),
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    updated_at = now();

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_payment_history_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

COMMIT;
