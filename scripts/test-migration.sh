#!/bin/sh
# Creates an isolated local cluster; never connects to a configured Supabase URL.
set -eu
cd "$(dirname "$0")/.."
HODAM_TEST_TMP=$(mktemp -d /tmp/hodam-accounting-test.XXXXXX)
cleanup() {
  pg_ctl -D "$HODAM_TEST_TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$HODAM_TEST_TMP"
}
trap cleanup EXIT INT TERM
initdb -D "$HODAM_TEST_TMP/data" --auth=trust --no-locale >/dev/null
pg_ctl -D "$HODAM_TEST_TMP/data" -l "$HODAM_TEST_TMP/server.log" -o "-k $HODAM_TEST_TMP -p 54599 -c listen_addresses=''" start >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$HODAM_TEST_TMP" -p 54599 -d postgres \
  -f tests/db/setup.sql \
  -f tests/db/legacy-accounting.sql \
  -f supabase/migrations/20260914010000_harden_hodam_accounting.sql \
  -f supabase/migrations/20260914010000_harden_hodam_accounting.sql \
  -f supabase/migrations/20260914020000_private_picturebook_storage.sql \
  -f supabase/migrations/20260914020000_private_picturebook_storage.sql \
  -f supabase/migrations/20261006010000_commit_picturebook_atomically.sql \
  -f supabase/migrations/20261006010000_commit_picturebook_atomically.sql \
  -f supabase/migrations/20261008010000_reading_feedback.sql \
  -f supabase/migrations/20261008010000_reading_feedback.sql \
  -f tests/db/rpc-surface-fixtures.sql \
  -f supabase/migrations/20260405133000_security_smoke_check.sql \
  -f supabase/migrations/20260406173000_security_integrity_smoke_check.sql \
  -f supabase/migrations/20260406123000_payment_webhook_transmission_registry.sql \
  -f supabase/migrations/20260407111000_payment_webhook_transmissions_reader_rpc.sql \
  -f supabase/migrations/20260407170000_add_auth_callback_attempt_metrics_reader_rpc.sql \
  -f supabase/migrations/20260407180000_harden_auth_callback_metric_writer_rpc.sql \
  -f supabase/migrations/20261008020000_narrow_security_definer_grants.sql \
  -f supabase/migrations/20261008020000_narrow_security_definer_grants.sql \
  -f supabase/migrations/20261008030000_reading_state_sync.sql \
  -f supabase/migrations/20261008030000_reading_state_sync.sql \
  -f tests/db/assertions.sql \
  -f tests/db/storage-assertions.sql \
  -f tests/db/picturebook-atomic-assertions.sql \
  -f tests/db/reading-feedback-assertions.sql \
  -f tests/db/rpc-surface-assertions.sql \
  -f tests/db/reading-state-assertions.sql
sh tests/db/picturebook-atomic-concurrency.sh "$HODAM_TEST_TMP"
sh tests/db/reading-state-concurrency.sh "$HODAM_TEST_TMP"
