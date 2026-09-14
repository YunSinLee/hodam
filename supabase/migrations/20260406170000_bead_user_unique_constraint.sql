BEGIN;

-- finalize_payment/consume_beads use ON CONFLICT (user_id). Ensure there is a
-- single row per user before adding the unique constraint.
WITH bead_rollup AS (
  SELECT
    user_id,
    (ARRAY_AGG(id ORDER BY created_at ASC, id ASC))[1] AS keep_id,
    COALESCE(SUM(count), 0) AS total_count,
    MIN(created_at) AS first_created_at,
    MAX(updated_at) AS last_updated_at
  FROM public.bead
  GROUP BY user_id
),
normalized AS (
  UPDATE public.bead AS b
  SET
    count = r.total_count,
    created_at = COALESCE(r.first_created_at, b.created_at),
    updated_at = COALESCE(r.last_updated_at, b.updated_at, now())
  FROM bead_rollup AS r
  WHERE b.id = r.keep_id
  RETURNING b.id
)
DELETE FROM public.bead AS b
USING bead_rollup AS r
WHERE b.user_id = r.user_id
  AND b.id <> r.keep_id;

ALTER TABLE public.bead
  ADD CONSTRAINT bead_user_id_key UNIQUE (user_id);

COMMIT;
