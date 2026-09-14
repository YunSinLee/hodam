BEGIN;

CREATE INDEX IF NOT EXISTS user_activity_logs_auth_callback_attempt_created_at_idx
  ON public.user_activity_logs ((details->>'oauthAttemptId'), created_at DESC)
  WHERE action IN (
    'auth_callback_event',
    'auth_callback_success',
    'auth_callback_error'
  )
    AND details ? 'oauthAttemptId';

COMMIT;
