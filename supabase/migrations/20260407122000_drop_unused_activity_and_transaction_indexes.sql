-- Drop unused write-heavy indexes while keeping FK-supporting indexes.
-- Retained:
-- - bead_transactions_user_request_id_unique (idempotency)
-- - bead_transactions_thread_id_idx / idx_bead_transactions_user_id (foreign key support)
-- - user_activity_logs_user_action_created_at_idx (user-scoped retention view access path)

DROP INDEX IF EXISTS public.idx_bead_transactions_created_at;
DROP INDEX IF EXISTS public.idx_user_activity_logs_created_at;
DROP INDEX IF EXISTS public.user_activity_logs_action_created_at_idx;

