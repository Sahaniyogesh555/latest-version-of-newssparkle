-- ============================================================================
-- SECURITY FIX: revoke anonymous write access to editorial tables.
--
-- Problem
-- -------
-- Migration 20260503120252 tried to let the public "only bump the view count"
-- with:
--     GRANT UPDATE (views) ON public.posts TO anon, authenticated;
--     CREATE POLICY "Anyone can increment views" ON public.posts FOR UPDATE
--       USING (status = 'published') WITH CHECK (status = 'published');
--
-- Two things make that ineffective:
--   1. Supabase grants ALL privileges on new tables in `public` to `anon` and
--      `authenticated` by default. A *column*-level GRANT adds a privilege, it
--      does not remove the existing table-wide UPDATE, so every column stayed
--      writable.
--   2. The RLS policy is scoped to rows, not columns. `WITH CHECK (status =
--      'published')` happily accepts `SET title = '...', content = '...'`.
--
-- Net effect: anyone holding the publishable (anon) key — which is shipped
-- inside the public JavaScript bundle — could rewrite, deface or hijack any
-- published article through PostgREST.
--
-- Fix: remove all write privileges from the public roles on editorial tables
-- and route the single legitimate write (the view counter) through a
-- SECURITY DEFINER function.
-- ============================================================================

-- 1. Public roles: read-only on posts/categories/notifications.
REVOKE ALL ON public.posts FROM anon, authenticated;
REVOKE ALL ON public.categories FROM anon, authenticated;
REVOKE ALL ON public.notifications FROM anon, authenticated;
REVOKE ALL ON public.feed_validation_runs FROM anon, authenticated;

GRANT SELECT ON public.posts TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.notifications TO anon, authenticated;
GRANT SELECT ON public.feed_validation_runs TO anon, authenticated;

-- 2. Drop the row-scoped write policy that made the loophole exploitable.
DROP POLICY IF EXISTS "Anyone can increment views" ON public.posts;

-- 3. Keep the read policies (idempotent re-creation).
DROP POLICY IF EXISTS "Public read published posts" ON public.posts;
CREATE POLICY "Public read published posts"
  ON public.posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- 4. View counter runs as the table owner, so the public role never needs
--    UPDATE on posts. SECURITY DEFINER + pinned search_path is the safe form.
CREATE OR REPLACE FUNCTION public.increment_post_views(
  post_slug text,
  visitor_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deduplicate per visitor per day when the client supplies a stable id.
  -- (Anonymous visitors without an id are still counted, best effort.)
  IF visitor_id IS NOT NULL AND length(visitor_id) BETWEEN 8 AND 128 THEN
    INSERT INTO public.post_view_events (slug, visitor_hash)
    VALUES (post_slug, md5(visitor_id))
    ON CONFLICT DO NOTHING;

    IF NOT FOUND THEN
      RETURN; -- already counted today
    END IF;
  END IF;

  UPDATE public.posts
     SET views = views + 1
   WHERE slug = post_slug
     AND status = 'published';
END;
$$;

REVOKE ALL ON FUNCTION public.increment_post_views(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_post_views(text, text) TO anon, authenticated;

-- 5. Verification helper — run this after applying:
--    SELECT grantee, privilege_type
--      FROM information_schema.table_privileges
--     WHERE table_schema = 'public' AND table_name = 'posts'
--       AND grantee IN ('anon','authenticated');
--    Expected: SELECT only.
