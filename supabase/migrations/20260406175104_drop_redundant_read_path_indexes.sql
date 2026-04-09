-- Drop indexes that are not referenced by current read paths.
-- - messages.created_at: message reads are keyed by thread_id and ordered by id/turn.
-- - payment_history.created_at/status: payment reads are keyed by user_id/order_id.
-- - image.thread_id: current image reads use Storage path listing instead of public.image lookups.

DROP INDEX IF EXISTS public.idx_messages_created_at;
DROP INDEX IF EXISTS public.idx_payment_history_created_at;
DROP INDEX IF EXISTS public.idx_payment_history_status;
DROP INDEX IF EXISTS public.idx_image_thread_id;
