BEGIN;

CREATE OR REPLACE FUNCTION public.hodam_security_smoke_check()
RETURNS TABLE(check_name text, ok boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, storage
AS $$
BEGIN
  RETURN QUERY
  WITH expected_tables AS (
    SELECT unnest(
      ARRAY[
        'users',
        'bead',
        'thread',
        'messages',
        'keywords',
        'selections',
        'payment_history'
      ]
    ) AS table_name
  )
  SELECT
    format('rls_enabled.%s', e.table_name) AS check_name,
    COALESCE(c.relrowsecurity, false) AS ok,
    CASE
      WHEN c.oid IS NULL THEN 'table_missing'
      WHEN c.relrowsecurity THEN 'enabled'
      ELSE 'disabled'
    END AS detail
  FROM expected_tables e
  LEFT JOIN pg_class c
    ON c.relname = e.table_name
   AND c.relkind = 'r'
   AND c.relnamespace = 'public'::regnamespace;

  RETURN QUERY
  WITH expected_policies AS (
    SELECT *
    FROM (
      VALUES
        ('public', 'users', 'users_select_own'),
        ('public', 'users', 'users_insert_own'),
        ('public', 'users', 'users_update_own'),
        ('public', 'bead', 'bead_select_own'),
        ('public', 'bead', 'bead_insert_own'),
        ('public', 'thread', 'thread_select_own'),
        ('public', 'thread', 'thread_insert_own'),
        ('public', 'thread', 'thread_update_own'),
        ('public', 'messages', 'messages_select_own'),
        ('public', 'payment_history', 'payment_history_select_own')
    ) AS t(schemaname, tablename, policyname)
  )
  SELECT
    format('policy_exists.%s.%s', ep.tablename, ep.policyname) AS check_name,
    EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = ep.schemaname
        AND p.tablename = ep.tablename
        AND p.policyname = ep.policyname
    ) AS ok,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = ep.schemaname
          AND p.tablename = ep.tablename
          AND p.policyname = ep.policyname
      ) THEN 'present'
      ELSE 'missing'
    END AS detail
  FROM expected_policies ep;

  RETURN QUERY
  SELECT
    'index_exists.payment_history_order_id_unique_key' AS check_name,
    EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class t
        ON t.oid = i.indrelid
      JOIN pg_namespace n
        ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'payment_history'
        AND i.indisunique
        AND EXISTS (
          SELECT 1
          FROM unnest(i.indkey) AS key_attnum
          JOIN pg_attribute a
            ON a.attrelid = t.oid
           AND a.attnum = key_attnum
          WHERE a.attname = 'order_id'
        )
    ) AS ok,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class t
          ON t.oid = i.indrelid
        JOIN pg_namespace n
          ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'payment_history'
          AND i.indisunique
          AND EXISTS (
            SELECT 1
            FROM unnest(i.indkey) AS key_attnum
            JOIN pg_attribute a
              ON a.attrelid = t.oid
             AND a.attnum = key_attnum
            WHERE a.attname = 'order_id'
          )
      ) THEN 'present'
      ELSE 'missing'
    END AS detail;

  RETURN QUERY
  SELECT
    'grant_execute.consume_beads.authenticated' AS check_name,
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
      ) THEN 'granted'
      ELSE 'missing'
    END AS detail;

  RETURN QUERY
  SELECT
    'grant_execute.finalize_payment.authenticated' AS check_name,
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
      ) THEN 'granted'
      ELSE 'missing'
    END AS detail;

  RETURN QUERY
  SELECT
    'grant_execute.consume_daily_quota.authenticated' AS check_name,
    has_function_privilege(
      'authenticated',
      'public.consume_daily_quota(uuid, text, integer, integer, jsonb)',
      'EXECUTE'
    ) AS ok,
    CASE
      WHEN has_function_privilege(
        'authenticated',
        'public.consume_daily_quota(uuid, text, integer, integer, jsonb)',
        'EXECUTE'
      ) THEN 'granted'
      ELSE 'missing'
    END AS detail;

  RETURN QUERY
  SELECT
    'storage_bucket_exists.image' AS check_name,
    EXISTS (
      SELECT 1
      FROM storage.buckets
      WHERE id = 'image'
    ) AS ok,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM storage.buckets
        WHERE id = 'image'
      ) THEN 'present'
      ELSE 'missing'
    END AS detail;

  RETURN QUERY
  SELECT
    'rls_enabled.storage.objects' AS check_name,
    COALESCE(MAX(c.relrowsecurity::int), 0) = 1 AS ok,
    CASE
      WHEN COALESCE(MAX(c.relrowsecurity::int), 0) = 1 THEN 'enabled'
      ELSE 'disabled_or_missing'
    END AS detail
  FROM pg_class c
  WHERE c.relname = 'objects'
    AND c.relkind = 'r'
    AND c.relnamespace = 'storage'::regnamespace;

  RETURN QUERY
  SELECT
    'policy_exists.storage.objects' AS check_name,
    COUNT(*) > 0 AS ok,
    format('count=%s', COUNT(*)) AS detail
  FROM pg_policies p
  WHERE p.schemaname = 'storage'
    AND p.tablename = 'objects';
END;
$$;

REVOKE ALL ON FUNCTION public.hodam_security_smoke_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hodam_security_smoke_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hodam_security_smoke_check() TO service_role;

COMMIT;
