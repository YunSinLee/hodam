-- Restore index to cover image.thread_id foreign key lookups.
-- Supabase advisor reports unindexed foreign key without this index.

CREATE INDEX IF NOT EXISTS idx_image_thread_id
  ON public.image (thread_id);
