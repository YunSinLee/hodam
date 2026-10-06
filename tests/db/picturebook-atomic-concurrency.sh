#!/bin/sh
# Only called against the private Unix socket made by test-migration.sh.
set -eu
HODAM_ATOMIC_SOCKET=${1:?isolated test socket required}
case "$HODAM_ATOMIC_SOCKET" in
  /tmp/hodam-accounting-test.*) ;;
  *) echo "Refusing a non-test database socket" >&2; exit 1 ;;
esac
test -f "$HODAM_ATOMIC_SOCKET/data/PG_VERSION"

db() {
  psql -X -qAt -v ON_ERROR_STOP=1 -h "$HODAM_ATOMIC_SOCKET" -p 54599 -d postgres "$@"
}
wait_until() {
  HODAM_ATOMIC_ATTEMPT=0
  while [ "$HODAM_ATOMIC_ATTEMPT" -lt 100 ]; do
    if [ "$(db -c "$1")" = "t" ]; then return; fi
    HODAM_ATOMIC_ATTEMPT=$((HODAM_ATOMIC_ATTEMPT + 1))
    sleep 0.05
  done
  echo "Concurrent test did not reach the required database state" >&2
  exit 1
}
expect_failure() {
  if wait "$1"; then
    echo "Expected worker failure did not occur" >&2
    exit 1
  fi
  if ! grep -Eq "$3" "$2"; then
    cat "$2" >&2
    exit 1
  fi
}

db <<'SQL'
INSERT INTO public.bead(user_id, count) VALUES
  ('a0000000-0000-4000-8000-000000000001', 1),
  ('a0000000-0000-4000-8000-000000000002', 1),
  ('a0000000-0000-4000-8000-000000000003', 3),
  ('a0000000-0000-4000-8000-000000000004', 3),
  ('a0000000-0000-4000-8000-000000000005', 3);
SQL

# Keep a SQL input pipe open until the second connection is demonstrably blocked.
# This makes overlap deterministic even on a slow CI host, without timed sleeps.
mkfifo "$HODAM_ATOMIC_SOCKET/same-a.sql"
PGAPPNAME=hodam-atomic-same-a db <"$HODAM_ATOMIC_SOCKET/same-a.sql" >"$HODAM_ATOMIC_SOCKET/same-a.log" 2>&1 &
HODAM_ATOMIC_FIRST=$!
exec 3>"$HODAM_ATOMIC_SOCKET/same-a.sql"
cat >&3 <<'SQL'
BEGIN;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT * FROM public.commit_picturebook_start('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', hodam_test.book('First concurrent winner'));
SQL
wait_until "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='hodam-atomic-same-a' AND state='idle in transaction' AND query LIKE '%commit_picturebook_start%')"
PGAPPNAME=hodam-atomic-same-b db 3>&- >"$HODAM_ATOMIC_SOCKET/same-b.log" 2>&1 <<'SQL' &
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$ DECLARE saved record; BEGIN
  SELECT * INTO STRICT saved FROM public.commit_picturebook_start('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', hodam_test.book('Losing candidate'));
  IF saved.bead_count <> 0 OR saved.raw_text::jsonb <> hodam_test.book('First concurrent winner') THEN
    RAISE EXCEPTION 'Concurrent replay did not return the winner at zero balance';
  END IF;
END; $$;
SQL
HODAM_ATOMIC_SECOND=$!
wait_until "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='hodam-atomic-same-b' AND wait_event_type='Lock')"
printf 'COMMIT;\n' >&3
exec 3>&-
wait "$HODAM_ATOMIC_FIRST"
wait "$HODAM_ATOMIC_SECOND"

# Distinct requests compete for one remaining bead. Exactly one commits.
mkfifo "$HODAM_ATOMIC_SOCKET/balance-a.sql"
PGAPPNAME=hodam-atomic-balance-a db <"$HODAM_ATOMIC_SOCKET/balance-a.sql" >"$HODAM_ATOMIC_SOCKET/balance-a.log" 2>&1 &
HODAM_ATOMIC_FIRST=$!
exec 3>"$HODAM_ATOMIC_SOCKET/balance-a.sql"
cat >&3 <<'SQL'
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT * FROM public.commit_picturebook_start('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', hodam_test.book());
SQL
wait_until "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='hodam-atomic-balance-a' AND state='idle in transaction' AND query LIKE '%commit_picturebook_start%')"
PGAPPNAME=hodam-atomic-balance-b db 3>&- >"$HODAM_ATOMIC_SOCKET/balance-b.log" 2>&1 <<'SQL' &
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT * FROM public.commit_picturebook_start('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', hodam_test.book());
SQL
HODAM_ATOMIC_SECOND=$!
wait_until "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='hodam-atomic-balance-b' AND wait_event_type='Lock')"
printf 'COMMIT;\n' >&3
exec 3>&-
wait "$HODAM_ATOMIC_FIRST"
expect_failure "$HODAM_ATOMIC_SECOND" "$HODAM_ATOMIC_SOCKET/balance-b.log" INSUFFICIENT_BEADS

# A legacy INSERT ignores the advisory lock. It becomes visible only after our
# initial lookup; the unique-key conflict must leave its blank reservation alone.
mkfifo "$HODAM_ATOMIC_SOCKET/legacy-a.sql"
PGAPPNAME=hodam-atomic-legacy-a db <"$HODAM_ATOMIC_SOCKET/legacy-a.sql" >"$HODAM_ATOMIC_SOCKET/legacy-a.log" 2>&1 &
HODAM_ATOMIC_FIRST=$!
exec 3>"$HODAM_ATOMIC_SOCKET/legacy-a.sql"
cat >&3 <<'SQL'
BEGIN;
INSERT INTO public.thread(user_id, openai_thread_id) VALUES
  ('a0000000-0000-4000-8000-000000000003', 'picturebook_b0000000-0000-4000-8000-000000000004');
SQL
wait_until "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='hodam-atomic-legacy-a' AND state='idle in transaction' AND query LIKE '%INSERT INTO public.thread%')"
PGAPPNAME=hodam-atomic-legacy-b db 3>&- >"$HODAM_ATOMIC_SOCKET/legacy-b.log" 2>&1 <<'SQL' &
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT * FROM public.commit_picturebook_start('a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', hodam_test.book());
SQL
HODAM_ATOMIC_SECOND=$!
wait_until "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='hodam-atomic-legacy-b' AND wait_event_type='Lock')"
printf 'COMMIT;\n' >&3
exec 3>&-
wait "$HODAM_ATOMIC_FIRST"
expect_failure "$HODAM_ATOMIC_SECOND" "$HODAM_ATOMIC_SOCKET/legacy-b.log" PICTUREBOOK_REQUEST_UNRESOLVED

# A fully saved legacy book winning the same unique race is reused unchanged.
mkfifo "$HODAM_ATOMIC_SOCKET/saved-a.sql"
PGAPPNAME=hodam-atomic-saved-a db <"$HODAM_ATOMIC_SOCKET/saved-a.sql" >"$HODAM_ATOMIC_SOCKET/saved-a.log" 2>&1 &
HODAM_ATOMIC_FIRST=$!
exec 3>"$HODAM_ATOMIC_SOCKET/saved-a.sql"
cat >&3 <<'SQL'
BEGIN;
INSERT INTO public.thread(user_id, openai_thread_id, raw_text) VALUES
  ('a0000000-0000-4000-8000-000000000004', 'picturebook_b0000000-0000-4000-8000-000000000005', hodam_test.book('Legacy winner', 8)::text);
SQL
wait_until "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='hodam-atomic-saved-a' AND state='idle in transaction' AND query LIKE '%INSERT INTO public.thread%')"
PGAPPNAME=hodam-atomic-saved-b db 3>&- >"$HODAM_ATOMIC_SOCKET/saved-b.log" 2>&1 <<'SQL' &
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$ DECLARE saved record; BEGIN
  SELECT * INTO STRICT saved FROM public.commit_picturebook_start('a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000005', hodam_test.book('Discarded'));
  IF saved.bead_count <> 3 OR saved.raw_text::jsonb <> hodam_test.book('Legacy winner', 8) THEN
    RAISE EXCEPTION 'Unique race did not preserve a legacy saved book';
  END IF;
END; $$;
SQL
HODAM_ATOMIC_SECOND=$!
wait_until "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='hodam-atomic-saved-b' AND wait_event_type='Lock')"
printf 'COMMIT;\n' >&3
exec 3>&-
wait "$HODAM_ATOMIC_FIRST"
wait "$HODAM_ATOMIC_SECOND"

# Terminate a backend after both writes, before transaction commit. This is a
# real process failure, not a mocked exception or an application-side refund.
PGAPPNAME=hodam-atomic-aborted db >"$HODAM_ATOMIC_SOCKET/aborted.log" 2>&1 <<'SQL' &
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT * FROM public.commit_picturebook_start('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000006', hodam_test.book());
SELECT pg_sleep(20);
COMMIT;
SQL
HODAM_ATOMIC_ABORTED=$!
wait_until "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='hodam-atomic-aborted' AND wait_event='PgSleep')"
db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='hodam-atomic-aborted'" >/dev/null
expect_failure "$HODAM_ATOMIC_ABORTED" "$HODAM_ATOMIC_SOCKET/aborted.log" 'terminating connection|server closed the connection'

db <<'SQL'
DO $$ DECLARE owner_id uuid; BEGIN
  FOREACH owner_id IN ARRAY ARRAY['a0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000002'::uuid] LOOP
    IF (SELECT count FROM public.bead WHERE user_id=owner_id) <> 0
       OR (SELECT count(*) FROM public.thread WHERE user_id=owner_id) <> 1
       OR (SELECT count(*) FROM public.bead_transactions WHERE user_id=owner_id) <> 1
       OR (SELECT amount FROM public.bead_transactions WHERE user_id=owner_id) <> -1 THEN
      RAISE EXCEPTION 'Concurrent workers left duplicate/missing books or debits';
    END IF;
  END LOOP;
  IF (SELECT count FROM public.bead WHERE user_id='a0000000-0000-4000-8000-000000000003') <> 3
     OR (SELECT count(*) FROM public.thread WHERE user_id='a0000000-0000-4000-8000-000000000003' AND raw_text IS NULL) <> 1
     OR EXISTS (SELECT 1 FROM public.bead_transactions WHERE user_id='a0000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Legacy reservation conflict changed the reservation or accounting';
  END IF;
  IF (SELECT count FROM public.bead WHERE user_id='a0000000-0000-4000-8000-000000000004') <> 3
     OR (SELECT count(*) FROM public.thread WHERE user_id='a0000000-0000-4000-8000-000000000004') <> 1
     OR EXISTS (SELECT 1 FROM public.bead_transactions WHERE user_id='a0000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'Legacy saved-book conflict changed accounting';
  END IF;
  IF (SELECT count FROM public.bead WHERE user_id='a0000000-0000-4000-8000-000000000005') <> 3
     OR EXISTS (SELECT 1 FROM public.thread WHERE user_id='a0000000-0000-4000-8000-000000000005')
     OR EXISTS (SELECT 1 FROM public.bead_transactions WHERE user_id='a0000000-0000-4000-8000-000000000005') THEN
    RAISE EXCEPTION 'Backend termination left a partial transaction';
  END IF;
END; $$;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$ DECLARE saved record; BEGIN
  SELECT * INTO STRICT saved FROM public.commit_picturebook_start('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000006', hodam_test.book());
  IF saved.bead_count <> 2 THEN RAISE EXCEPTION 'Retry after backend termination did not recover'; END IF;
END; $$;
SELECT 'Atomic picturebook concurrency and process-failure assertions passed';
SQL
