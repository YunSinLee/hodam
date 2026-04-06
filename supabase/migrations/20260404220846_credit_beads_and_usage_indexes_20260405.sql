BEGIN;

CREATE INDEX IF NOT EXISTS user_activity_logs_action_created_at_idx
  ON public.user_activity_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_logs_user_action_created_at_idx
  ON public.user_activity_logs (user_id, action, created_at DESC);

CREATE OR REPLACE FUNCTION public.credit_beads(
  p_user_id uuid,
  p_amount integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_count integer;
BEGIN
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  INSERT INTO public.bead(user_id, count)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.bead
  SET count = count + p_amount
  WHERE user_id = p_user_id
  RETURNING count INTO v_next_count;

  RETURN COALESCE(v_next_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_beads(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_beads(uuid, integer) TO authenticated;

COMMIT;
