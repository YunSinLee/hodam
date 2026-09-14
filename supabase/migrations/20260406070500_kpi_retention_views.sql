BEGIN;

CREATE OR REPLACE VIEW public.kpi_retention_daily AS
WITH user_activity_days AS (
  SELECT
    user_id,
    date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS activity_date
  FROM public.user_activity_logs
  WHERE user_id IS NOT NULL
  GROUP BY user_id, date_trunc('day', created_at AT TIME ZONE 'UTC')::date
),
cohorts AS (
  SELECT
    user_id,
    MIN(activity_date) AS cohort_date
  FROM user_activity_days
  GROUP BY user_id
),
cohort_flags AS (
  SELECT
    c.user_id,
    c.cohort_date,
    EXISTS (
      SELECT 1
      FROM user_activity_days a
      WHERE a.user_id = c.user_id
        AND a.activity_date = c.cohort_date + 1
    ) AS retained_d1,
    EXISTS (
      SELECT 1
      FROM user_activity_days a
      WHERE a.user_id = c.user_id
        AND a.activity_date = c.cohort_date + 7
    ) AS retained_d7
  FROM cohorts c
)
SELECT
  cohort_date,
  COUNT(*)::bigint AS cohort_size,
  COUNT(*) FILTER (WHERE retained_d1)::bigint AS d1_retained_users,
  COUNT(*) FILTER (WHERE retained_d7)::bigint AS d7_retained_users,
  CASE
    WHEN COUNT(*) > 0
    THEN ROUND(
      (COUNT(*) FILTER (WHERE retained_d1))::numeric / COUNT(*)::numeric,
      4
    )
    ELSE 0::numeric
  END AS d1_retention_rate,
  CASE
    WHEN COUNT(*) > 0
    THEN ROUND(
      (COUNT(*) FILTER (WHERE retained_d7))::numeric / COUNT(*)::numeric,
      4
    )
    ELSE 0::numeric
  END AS d7_retention_rate
FROM cohort_flags
GROUP BY cohort_date
ORDER BY cohort_date DESC;

CREATE OR REPLACE VIEW public.kpi_user_retention AS
WITH user_activity_days AS (
  SELECT
    user_id,
    date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS activity_date
  FROM public.user_activity_logs
  WHERE user_id IS NOT NULL
  GROUP BY user_id, date_trunc('day', created_at AT TIME ZONE 'UTC')::date
),
cohorts AS (
  SELECT
    user_id,
    MIN(activity_date) AS cohort_date
  FROM user_activity_days
  GROUP BY user_id
)
SELECT
  c.user_id,
  c.cohort_date,
  EXISTS (
    SELECT 1
    FROM user_activity_days a
    WHERE a.user_id = c.user_id
      AND a.activity_date = c.cohort_date + 1
  ) AS retained_d1,
  EXISTS (
    SELECT 1
    FROM user_activity_days a
    WHERE a.user_id = c.user_id
      AND a.activity_date = c.cohort_date + 7
  ) AS retained_d7,
  GREATEST((CURRENT_DATE - c.cohort_date)::integer, 0) AS cohort_age_days
FROM cohorts c;

GRANT SELECT ON public.kpi_retention_daily TO authenticated;
GRANT SELECT ON public.kpi_user_retention TO authenticated;

ALTER VIEW public.kpi_retention_daily
  SET (security_invoker = true);

ALTER VIEW public.kpi_user_retention
  SET (security_invoker = true);

COMMIT;
