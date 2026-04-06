BEGIN;

ALTER TABLE IF EXISTS public.payment_history
  ADD COLUMN IF NOT EXISTS credited_at timestamptz,
  ADD COLUMN IF NOT EXISTS credited_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS payment_history_order_id_unique
  ON public.payment_history (order_id);

CREATE INDEX IF NOT EXISTS thread_user_created_at_idx
  ON public.thread (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_thread_turn_id_idx
  ON public.messages (thread_id, turn, id);

CREATE INDEX IF NOT EXISTS payment_history_user_created_at_idx
  ON public.payment_history (user_id, created_at DESC);

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bead ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'thread'
      AND policyname = 'thread_select_own'
  ) THEN
    CREATE POLICY thread_select_own ON public.thread
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'thread'
      AND policyname = 'thread_modify_own'
  ) THEN
    CREATE POLICY thread_modify_own ON public.thread
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'messages_select_own'
  ) THEN
    CREATE POLICY messages_select_own ON public.messages
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.thread t
          WHERE t.id = messages.thread_id
            AND t.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_history'
      AND policyname = 'payment_history_select_own'
  ) THEN
    CREATE POLICY payment_history_select_own ON public.payment_history
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.consume_beads(
  p_user_id uuid,
  p_cost integer,
  p_request_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_count integer;
BEGIN
  IF p_cost < 0 THEN
    RAISE EXCEPTION 'INVALID_COST';
  END IF;

  INSERT INTO public.bead(user_id, count)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.bead
  SET count = count - p_cost
  WHERE user_id = p_user_id
    AND count >= p_cost
  RETURNING count INTO v_next_count;

  IF v_next_count IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_BEADS';
  END IF;

  RETURN v_next_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_payment(
  p_order_id text,
  p_payment_key text,
  p_user_id uuid
)
RETURNS TABLE (bead_count integer, already_processed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payment_history%ROWTYPE;
BEGIN
  SELECT *
  INTO v_payment
  FROM public.payment_history
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  IF v_payment.user_id <> p_user_id THEN
    RAISE EXCEPTION 'PAYMENT_USER_MISMATCH';
  END IF;

  IF v_payment.status = 'completed' THEN
    SELECT b.count INTO bead_count
    FROM public.bead b
    WHERE b.user_id = p_user_id;

    bead_count := COALESCE(bead_count, 0);
    already_processed := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.payment_history
  SET status = 'completed',
      payment_key = p_payment_key,
      completed_at = COALESCE(completed_at, now()),
      credited_at = COALESCE(credited_at, now()),
      credited_user_id = COALESCE(credited_user_id, p_user_id)
  WHERE id = v_payment.id;

  INSERT INTO public.bead(user_id, count)
  VALUES (p_user_id, v_payment.bead_quantity)
  ON CONFLICT (user_id)
  DO UPDATE SET count = public.bead.count + EXCLUDED.count
  RETURNING count INTO bead_count;

  already_processed := FALSE;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_threads()
RETURNS SETOF public.thread
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.*
  FROM public.thread t
  WHERE t.user_id = auth.uid()
  ORDER BY t.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_thread_detail(p_thread_id bigint)
RETURNS TABLE (
  thread_row public.thread,
  messages jsonb,
  selections jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t,
    COALESCE(
      (
        SELECT jsonb_agg(m ORDER BY m.turn, m.id)
        FROM public.messages m
        WHERE m.thread_id = t.id
      ),
      '[]'::jsonb
    ) AS messages,
    COALESCE(
      (
        SELECT jsonb_agg(s ORDER BY s.turn, s.id)
        FROM public.selections s
        WHERE s.thread_id = t.id
      ),
      '[]'::jsonb
    ) AS selections
  FROM public.thread t
  WHERE t.id = p_thread_id
    AND t.user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.consume_beads(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_payment(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_threads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_thread_detail(bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_threads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_detail(bigint) TO authenticated;

COMMIT;
