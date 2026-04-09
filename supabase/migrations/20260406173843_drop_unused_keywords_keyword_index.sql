-- Drop unused keyword lookup index.
-- Current read paths fetch keywords by thread_id; keyword column lookup is not used.

DROP INDEX IF EXISTS public.idx_keywords_keyword;
