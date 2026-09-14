BEGIN;

REVOKE EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_threads() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_thread_detail(bigint) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_threads() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_thread_detail(bigint) FROM anon;

GRANT EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_threads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_detail(bigint) TO authenticated;

GRANT EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_threads() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_thread_detail(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.hodam_security_grants_smoke_check()
RETURNS TABLE(check_name text, ok boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'function_execute_deny_anon.consume_beads' AS check_name,
    NOT has_function_privilege(
      'anon',
      'public.consume_beads(uuid, integer, text)',
      'EXECUTE'
    ) AS ok,
    CASE
      WHEN has_function_privilege(
        'anon',
        'public.consume_beads(uuid, integer, text)',
        'EXECUTE'
      ) THEN 'anon_can_execute'
      ELSE 'anon_blocked'
    END AS detail;

  RETURN QUERY
  SELECT
    'function_execute_deny_anon.finalize_payment' AS check_name,
    NOT has_function_privilege(
      'anon',
      'public.finalize_payment(text, text, uuid)',
      'EXECUTE'
    ) AS ok,
    CASE
      WHEN has_function_privilege(
        'anon',
        'public.finalize_payment(text, text, uuid)',
        'EXECUTE'
      ) THEN 'anon_can_execute'
      ELSE 'anon_blocked'
    END AS detail;

  RETURN QUERY
  SELECT
    'function_execute_deny_anon.get_my_threads' AS check_name,
    NOT has_function_privilege('anon', 'public.get_my_threads()', 'EXECUTE') AS ok,
    CASE
      WHEN has_function_privilege('anon', 'public.get_my_threads()', 'EXECUTE')
      THEN 'anon_can_execute'
      ELSE 'anon_blocked'
    END AS detail;

  RETURN QUERY
  SELECT
    'function_execute_deny_anon.get_thread_detail' AS check_name,
    NOT has_function_privilege(
      'anon',
      'public.get_thread_detail(bigint)',
      'EXECUTE'
    ) AS ok,
    CASE
      WHEN has_function_privilege(
        'anon',
        'public.get_thread_detail(bigint)',
        'EXECUTE'
      ) THEN 'anon_can_execute'
      ELSE 'anon_blocked'
    END AS detail;

  RETURN QUERY
  SELECT
    'function_execute_allow_authenticated.consume_beads' AS check_name,
    has_function_privilege(
      'authenticated',
      'public.consume_beads(uuid, integer, text)',
      'EXECUTE'
    ) AS ok,
    CASE
      WHEN has_function_privilege(
        'authenticated',
        'public.consume_beads(uuid, integer, text)',
        'EXECUTE'
      ) THEN 'authenticated_granted'
      ELSE 'authenticated_missing'
    END AS detail;

  RETURN QUERY
  SELECT
    'function_execute_allow_authenticated.finalize_payment' AS check_name,
    has_function_privilege(
      'authenticated',
      'public.finalize_payment(text, text, uuid)',
      'EXECUTE'
    ) AS ok,
    CASE
      WHEN has_function_privilege(
        'authenticated',
        'public.finalize_payment(text, text, uuid)',
        'EXECUTE'
      ) THEN 'authenticated_granted'
      ELSE 'authenticated_missing'
    END AS detail;

  RETURN QUERY
  SELECT
    'function_execute_allow_authenticated.get_my_threads' AS check_name,
    has_function_privilege(
      'authenticated',
      'public.get_my_threads()',
      'EXECUTE'
    ) AS ok,
    CASE
      WHEN has_function_privilege(
        'authenticated',
        'public.get_my_threads()',
        'EXECUTE'
      ) THEN 'authenticated_granted'
      ELSE 'authenticated_missing'
    END AS detail;

  RETURN QUERY
  SELECT
    'function_execute_allow_authenticated.get_thread_detail' AS check_name,
    has_function_privilege(
      'authenticated',
      'public.get_thread_detail(bigint)',
      'EXECUTE'
    ) AS ok,
    CASE
      WHEN has_function_privilege(
        'authenticated',
        'public.get_thread_detail(bigint)',
        'EXECUTE'
      ) THEN 'authenticated_granted'
      ELSE 'authenticated_missing'
    END AS detail;
END;
$$;

REVOKE ALL ON FUNCTION public.hodam_security_grants_smoke_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hodam_security_grants_smoke_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hodam_security_grants_smoke_check() TO service_role;

COMMIT;
