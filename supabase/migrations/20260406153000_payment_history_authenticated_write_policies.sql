-- Allow limited authenticated writes for payment preparation/failure handling
-- when server admin fallback is used without SUPABASE_SERVICE_ROLE_KEY.

drop policy if exists payment_history_insert_own_pending on public.payment_history;
create policy payment_history_insert_own_pending
on public.payment_history
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and amount > 0
  and bead_quantity > 0
  and payment_key is null
  and completed_at is null
  and credited_at is null
  and credited_user_id is null
);

drop policy if exists payment_history_update_own_pending on public.payment_history;
create policy payment_history_update_own_pending
on public.payment_history
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'pending'
)
with check (
  (select auth.uid()) = user_id
  and status in ('pending', 'failed', 'cancelled')
  and payment_key is null
  and completed_at is null
  and credited_at is null
  and credited_user_id is null
);
