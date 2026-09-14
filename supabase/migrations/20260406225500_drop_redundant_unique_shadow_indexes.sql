-- Remove redundant non-unique indexes shadowed by existing unique indexes.
-- users.email is already covered by users_email_unique.
-- payment_history.order_id is already covered by payment_history_order_id_key.

DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_payment_history_order_id;
