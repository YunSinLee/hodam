-- Drop single-column indexes shadowed by composite indexes with same leading key.
-- payment_history.user_id is covered by payment_history_user_created_at_idx (user_id, created_at DESC).
-- user_activity_logs.user_id is covered by user_activity_logs_user_action_created_at_idx (user_id, action, created_at DESC).

DROP INDEX IF EXISTS public.idx_payment_history_user_id;
DROP INDEX IF EXISTS public.idx_user_activity_logs_user_id;
