BEGIN;

CREATE OR REPLACE VIEW public.kpi_daily AS
WITH base AS (
  SELECT
    date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS metric_date,
    action,
    details
  FROM public.user_activity_logs
),
aggregated AS (
  SELECT
    metric_date,
    COUNT(*) FILTER (WHERE action = 'create_start')::bigint AS create_start,
    COUNT(*) FILTER (WHERE action = 'create_success')::bigint AS create_success,
    COUNT(*) FILTER (WHERE action = 'continue_step')::bigint AS continue_step,
    COUNT(*) FILTER (WHERE action = 'translation_click')::bigint AS translation_click,
    COUNT(*) FILTER (WHERE action = 'image_generated')::bigint AS image_generated,
    COUNT(*) FILTER (WHERE action = 'purchase_prepare')::bigint AS purchase_prepare,
    COUNT(*) FILTER (WHERE action = 'purchase_success')::bigint AS purchase_success,
    COUNT(*) FILTER (WHERE action = 'auth_callback_success')::bigint AS auth_callback_success,
    COUNT(*) FILTER (WHERE action = 'auth_callback_error')::bigint AS auth_callback_error,
    COUNT(*) FILTER (
      WHERE action = 'auth_callback_success'
        AND lower(COALESCE(details ->> 'provider', '')) = 'google'
    )::bigint AS auth_callback_success_google,
    COUNT(*) FILTER (
      WHERE action = 'auth_callback_success'
        AND lower(COALESCE(details ->> 'provider', '')) = 'kakao'
    )::bigint AS auth_callback_success_kakao,
    COUNT(*) FILTER (
      WHERE action = 'auth_callback_error'
        AND lower(COALESCE(details ->> 'provider', '')) = 'google'
    )::bigint AS auth_callback_error_google,
    COUNT(*) FILTER (
      WHERE action = 'auth_callback_error'
        AND lower(COALESCE(details ->> 'provider', '')) = 'kakao'
    )::bigint AS auth_callback_error_kakao,
    COALESCE(
      SUM(
        CASE
          WHEN action = 'ai_cost'
            AND jsonb_typeof(details -> 'cost') = 'number'
          THEN (details ->> 'cost')::integer
          WHEN action = 'ai_cost'
            AND jsonb_typeof(details -> 'cost') = 'string'
            AND (details ->> 'cost') ~ '^[0-9]+$'
          THEN (details ->> 'cost')::integer
          ELSE 0
        END
      ),
      0
    )::bigint AS ai_cost_total,
    COALESCE(
      SUM(
        CASE
          WHEN action = 'tts_chars'
            AND jsonb_typeof(details -> 'cost') = 'number'
          THEN (details ->> 'cost')::integer
          WHEN action = 'tts_chars'
            AND jsonb_typeof(details -> 'cost') = 'string'
            AND (details ->> 'cost') ~ '^[0-9]+$'
          THEN (details ->> 'cost')::integer
          ELSE 0
        END
      ),
      0
    )::bigint AS tts_chars_total
  FROM base
  GROUP BY metric_date
)
SELECT
  metric_date,
  create_start,
  create_success,
  continue_step,
  translation_click,
  image_generated,
  purchase_prepare,
  purchase_success,
  ai_cost_total,
  tts_chars_total,
  CASE
    WHEN create_success > 0
    THEN ROUND(ai_cost_total::numeric / create_success::numeric, 2)
    ELSE 0::numeric
  END AS cost_per_story,
  auth_callback_success,
  auth_callback_error,
  auth_callback_success_google,
  auth_callback_success_kakao,
  auth_callback_error_google,
  auth_callback_error_kakao
FROM aggregated
ORDER BY metric_date DESC;

GRANT SELECT ON public.kpi_daily TO authenticated;

ALTER VIEW public.kpi_daily
SET (security_invoker = true);

COMMIT;

