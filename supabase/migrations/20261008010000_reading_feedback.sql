BEGIN;

-- One editable response per owned book, with no child's name, story text, or
-- free-form comment. Deploy this before enabling the reader feedback UI.
CREATE TABLE IF NOT EXISTS public.reading_feedback (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  thread_id bigint NOT NULL REFERENCES public.thread(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('again', 'disappointed')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reading_feedback_pkey PRIMARY KEY (user_id, thread_id),
  CONSTRAINT reading_feedback_reason_check CHECK (
    reason IS NULL OR
    (rating = 'again' AND reason IN ('story', 'illustrations', 'personalization')) OR
    (rating = 'disappointed' AND reason IN ('story', 'illustrations', 'length', 'language'))
  )
);
CREATE INDEX IF NOT EXISTS reading_feedback_thread_id_idx ON public.reading_feedback(thread_id);
ALTER TABLE public.reading_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_feedback FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reading_feedback_owner_select ON public.reading_feedback;
CREATE POLICY reading_feedback_owner_select ON public.reading_feedback FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.thread t WHERE t.id = thread_id AND t.user_id = (SELECT auth.uid())
  ));
DROP POLICY IF EXISTS reading_feedback_owner_insert ON public.reading_feedback;
CREATE POLICY reading_feedback_owner_insert ON public.reading_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.thread t WHERE t.id = thread_id AND t.user_id = (SELECT auth.uid())
  ));
DROP POLICY IF EXISTS reading_feedback_owner_update ON public.reading_feedback;
CREATE POLICY reading_feedback_owner_update ON public.reading_feedback FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.thread t WHERE t.id = thread_id AND t.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.thread t WHERE t.id = thread_id AND t.user_id = (SELECT auth.uid())
  ));

REVOKE ALL ON TABLE public.reading_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.reading_feedback TO authenticated;
GRANT INSERT (thread_id, rating, reason), UPDATE (rating, reason) ON public.reading_feedback TO authenticated;
GRANT ALL ON TABLE public.reading_feedback TO service_role;

CREATE OR REPLACE FUNCTION public.touch_reading_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$ BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.touch_reading_feedback() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reading_feedback_updated ON public.reading_feedback;
CREATE TRIGGER reading_feedback_updated BEFORE UPDATE ON public.reading_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_reading_feedback();

CREATE OR REPLACE FUNCTION public.save_reading_feedback(
  p_thread_id bigint, p_rating text, p_reason text DEFAULT NULL
)
RETURNS TABLE(rating text, reason text, updated_at timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
  INSERT INTO public.reading_feedback (thread_id, rating, reason)
    VALUES (p_thread_id, p_rating, p_reason)
    ON CONFLICT ON CONSTRAINT reading_feedback_pkey DO UPDATE
      SET rating = EXCLUDED.rating, reason = EXCLUDED.reason
    RETURNING reading_feedback.rating, reading_feedback.reason, reading_feedback.updated_at;
$$;
REVOKE ALL ON FUNCTION public.save_reading_feedback(bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_reading_feedback(bigint, text, text) TO authenticated, service_role;

COMMIT;
