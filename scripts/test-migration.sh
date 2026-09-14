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
  -f tests/db/assertions.sql \
  -f tests/db/storage-assertions.sql
