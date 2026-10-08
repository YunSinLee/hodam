#!/bin/sh
set -eu
HODAM_READING_TEST_SOCKET=$1
HODAM_READING_TEST_OWNER=11111111-1111-4111-8111-111111111111
HODAM_READING_TEST_ID=$(psql -XqAt -v ON_ERROR_STOP=1 -h "$HODAM_READING_TEST_SOCKET" -p 54599 -d postgres -c "INSERT INTO public.thread(user_id, openai_thread_id) VALUES ('$HODAM_READING_TEST_OWNER', 'picturebook_reading_concurrency') RETURNING id")
HODAM_READING_TEST_AUTH="SET ROLE authenticated; SET request.jwt.claim.role = 'authenticated'; SET request.jwt.claim.sub = '$HODAM_READING_TEST_OWNER';"

# Both devices submit expectedVersion=0. Exactly one may apply; the loser sees
# the authoritative version rather than silently overwriting the other device.
psql -XqAt -v ON_ERROR_STOP=1 -h "$HODAM_READING_TEST_SOCKET" -p 54599 -d postgres \
  -c "$HODAM_READING_TEST_AUTH SELECT applied || ':' || favorite_version FROM public.save_reading_state($HODAM_READING_TEST_ID, 'favorite', 0, true)" > "$HODAM_READING_TEST_SOCKET/reading-a.out" &
HODAM_READING_TEST_PID_A=$!
psql -XqAt -v ON_ERROR_STOP=1 -h "$HODAM_READING_TEST_SOCKET" -p 54599 -d postgres \
  -c "$HODAM_READING_TEST_AUTH SELECT applied || ':' || favorite_version FROM public.save_reading_state($HODAM_READING_TEST_ID, 'favorite', 0, false)" > "$HODAM_READING_TEST_SOCKET/reading-b.out" &
HODAM_READING_TEST_PID_B=$!
wait "$HODAM_READING_TEST_PID_A"
wait "$HODAM_READING_TEST_PID_B"
HODAM_READING_TEST_RESULTS=$(cat "$HODAM_READING_TEST_SOCKET/reading-a.out" "$HODAM_READING_TEST_SOCKET/reading-b.out" | sort)
[ "$HODAM_READING_TEST_RESULTS" = "false:1
true:1" ] || { echo "Concurrent CAS did not select exactly one winner" >&2; exit 1; }

# Changes to the other field use its own version and both must survive.
psql -XqAt -v ON_ERROR_STOP=1 -h "$HODAM_READING_TEST_SOCKET" -p 54599 -d postgres \
  -c "$HODAM_READING_TEST_AUTH SELECT applied FROM public.save_reading_state($HODAM_READING_TEST_ID, 'favorite', 1, true)" > "$HODAM_READING_TEST_SOCKET/reading-a.out" &
HODAM_READING_TEST_PID_A=$!
psql -XqAt -v ON_ERROR_STOP=1 -h "$HODAM_READING_TEST_SOCKET" -p 54599 -d postgres \
  -c "$HODAM_READING_TEST_AUTH SELECT applied FROM public.save_reading_state($HODAM_READING_TEST_ID, 'progress', 0, NULL, 3, 8, false)" > "$HODAM_READING_TEST_SOCKET/reading-b.out" &
HODAM_READING_TEST_PID_B=$!
wait "$HODAM_READING_TEST_PID_A"
wait "$HODAM_READING_TEST_PID_B"
[ "$(cat "$HODAM_READING_TEST_SOCKET/reading-a.out")" = "t" ]
[ "$(cat "$HODAM_READING_TEST_SOCKET/reading-b.out")" = "t" ]
HODAM_READING_TEST_STATE=$(psql -XqAt -v ON_ERROR_STOP=1 -h "$HODAM_READING_TEST_SOCKET" -p 54599 -d postgres \
  -c "SELECT favorite || ':' || favorite_version || ':' || page_index || ':' || progress_version FROM public.reading_state WHERE thread_id = $HODAM_READING_TEST_ID")
[ "$HODAM_READING_TEST_STATE" = "true:2:3:1" ]
echo "Concurrent reading-state CAS and independent-field assertions passed"
