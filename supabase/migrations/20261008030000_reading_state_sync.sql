BEGIN;

-- Account-scoped preferences only: no story text, title, child name or image URL.
CREATE TABLE IF NOT EXISTS public.reading_state (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  thread_id bigint NOT NULL REFERENCES public.thread(id) ON DELETE CASCADE,
  favorite boolean NOT NULL DEFAULT false,
  favorite_version integer NOT NULL DEFAULT 0 CHECK (favorite_version BETWEEN 0 AND 2147483646),
  page_index integer,
  page_count integer,
  completed boolean NOT NULL DEFAULT false,
  progress_updated_at timestamptz,
  progress_version integer NOT NULL DEFAULT 0 CHECK (progress_version BETWEEN 0 AND 2147483646),
  CONSTRAINT reading_state_pkey PRIMARY KEY (user_id, thread_id),
  CONSTRAINT reading_state_progress_check CHECK (
    (page_index IS NULL AND page_count IS NULL AND NOT completed AND progress_updated_at IS NULL) OR
    (page_index IS NOT NULL AND page_count IS NOT NULL AND progress_updated_at IS NOT NULL
      AND page_count BETWEEN 1 AND 100 AND page_index BETWEEN 0 AND page_count - 1)
  )
);
CREATE INDEX IF NOT EXISTS reading_state_thread_id_idx ON public.reading_state(thread_id);
ALTER TABLE public.reading_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reading_state_owner_select ON public.reading_state;
CREATE POLICY reading_state_owner_select ON public.reading_state FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.thread t WHERE t.id = thread_id AND t.user_id = (SELECT auth.uid())
  ));
DROP POLICY IF EXISTS reading_state_owner_insert ON public.reading_state;
CREATE POLICY reading_state_owner_insert ON public.reading_state FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.thread t WHERE t.id = thread_id AND t.user_id = (SELECT auth.uid())
  ));
DROP POLICY IF EXISTS reading_state_owner_update ON public.reading_state;
CREATE POLICY reading_state_owner_update ON public.reading_state FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.thread t WHERE t.id = thread_id AND t.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.thread t WHERE t.id = thread_id AND t.user_id = (SELECT auth.uid())
  ));

REVOKE ALL ON TABLE public.reading_state FROM PUBLIC, anon, authenticated;
REVOKE ALL (user_id, thread_id, favorite, favorite_version, page_index, page_count, completed, progress_updated_at, progress_version)
  ON public.reading_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reading_state TO authenticated;
GRANT INSERT (thread_id), UPDATE (favorite, page_index, page_count, completed) ON public.reading_state TO authenticated;
GRANT ALL ON public.reading_state TO service_role;

CREATE OR REPLACE FUNCTION public.bump_reading_favorite_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$ BEGIN
  IF OLD.favorite_version >= 2147483646 THEN RAISE EXCEPTION 'READING_STATE_VERSION_EXHAUSTED'; END IF;
  NEW.favorite_version := OLD.favorite_version + 1;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.bump_reading_progress_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$ BEGIN
  IF OLD.progress_version >= 2147483646 THEN RAISE EXCEPTION 'READING_STATE_VERSION_EXHAUSTED'; END IF;
  NEW.progress_version := OLD.progress_version + 1;
  NEW.progress_updated_at := clock_timestamp();
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.bump_reading_favorite_version(), public.bump_reading_progress_version() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reading_state_favorite_version ON public.reading_state;
CREATE TRIGGER reading_state_favorite_version BEFORE UPDATE OF favorite ON public.reading_state
  FOR EACH ROW EXECUTE FUNCTION public.bump_reading_favorite_version();
DROP TRIGGER IF EXISTS reading_state_progress_version ON public.reading_state;
CREATE TRIGGER reading_state_progress_version BEFORE UPDATE OF page_index, page_count, completed ON public.reading_state
  FOR EACH ROW EXECUTE FUNCTION public.bump_reading_progress_version();

CREATE OR REPLACE FUNCTION public.save_reading_state(
  p_thread_id bigint,
  p_field text,
  p_expected_version integer,
  p_favorite boolean DEFAULT NULL,
  p_page_index integer DEFAULT NULL,
  p_page_count integer DEFAULT NULL,
  p_completed boolean DEFAULT NULL
)
RETURNS TABLE(applied boolean, thread_id bigint, favorite boolean, favorite_version integer,
  page_index integer, page_count integer, completed boolean, progress_updated_at timestamptz, progress_version integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_state public.reading_state%ROWTYPE;
  v_applied boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_thread_id IS NULL OR p_thread_id <= 0 OR p_expected_version IS NULL
    OR p_expected_version NOT BETWEEN 0 AND 2147483646
    OR p_field IS NULL OR p_field NOT IN ('favorite', 'progress') THEN
    RAISE EXCEPTION 'READING_STATE_INVALID';
  END IF;
  IF p_field = 'favorite' THEN
    IF p_favorite IS NULL OR p_page_index IS NOT NULL OR p_page_count IS NOT NULL OR p_completed IS NOT NULL THEN
      RAISE EXCEPTION 'READING_STATE_INVALID';
    END IF;
  ELSE
    IF p_favorite IS NOT NULL OR p_page_index IS NULL OR p_page_count IS NULL OR p_completed IS NULL
      OR p_page_count NOT BETWEEN 1 AND 100 OR p_page_index NOT BETWEEN 0 AND p_page_count - 1 THEN
      RAISE EXCEPTION 'READING_STATE_INVALID';
    END IF;
  END IF;

  -- RLS rejects foreign books before a row can be created. Defaults keep all
  -- protected values server-controlled, and concurrent first writes serialize.
  INSERT INTO public.reading_state(thread_id) VALUES (p_thread_id)
    ON CONFLICT ON CONSTRAINT reading_state_pkey DO NOTHING;
  SELECT rs.* INTO STRICT v_state FROM public.reading_state rs
    WHERE rs.user_id = auth.uid() AND rs.thread_id = p_thread_id FOR UPDATE;

  IF p_field = 'favorite' AND v_state.favorite_version = p_expected_version THEN
    UPDATE public.reading_state rs SET favorite = p_favorite
      WHERE rs.user_id = auth.uid() AND rs.thread_id = p_thread_id RETURNING rs.* INTO v_state;
    v_applied := true;
  ELSIF p_field = 'progress' AND v_state.progress_version = p_expected_version THEN
    UPDATE public.reading_state rs SET page_index = p_page_index, page_count = p_page_count, completed = p_completed
      WHERE rs.user_id = auth.uid() AND rs.thread_id = p_thread_id RETURNING rs.* INTO v_state;
    v_applied := true;
  END IF;

  RETURN QUERY SELECT v_applied, v_state.thread_id, v_state.favorite, v_state.favorite_version,
    v_state.page_index, v_state.page_count, v_state.completed, v_state.progress_updated_at, v_state.progress_version;
END; $$;
REVOKE ALL ON FUNCTION public.save_reading_state(bigint, text, integer, boolean, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_reading_state(bigint, text, integer, boolean, integer, integer, boolean) TO authenticated, service_role;

COMMIT;
