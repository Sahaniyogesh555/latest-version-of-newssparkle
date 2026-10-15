-- ============================================================================
-- View-count integrity: record one view per visitor per article per day.
--
-- `views` drives the Trending rails and article ordering, so an unbounded
-- counter is both a spam vector and a rankings manipulation vector. The table
-- below is written only by public.increment_post_views (SECURITY DEFINER) and
-- has no RLS policies, so it is unreachable from the API.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.post_view_events (
  slug          text        NOT NULL,
  visitor_hash  text        NOT NULL,
  view_day      date        NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slug, visitor_hash, view_day)
);

CREATE INDEX IF NOT EXISTS idx_post_view_events_day
  ON public.post_view_events (view_day DESC);

ALTER TABLE public.post_view_events ENABLE ROW LEVEL SECURITY;

-- No policies are created: with RLS enabled and no policy, anon/authenticated
-- get zero rows and cannot write. Service role bypasses RLS for maintenance.
REVOKE ALL ON public.post_view_events FROM anon, authenticated;

-- Retention: drop per-visitor rows older than 90 days (keeps the table small;
-- the aggregate numbers live on posts.views).
CREATE OR REPLACE FUNCTION public.prune_post_view_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.post_view_events
   WHERE view_day < (now() AT TIME ZONE 'UTC')::date - INTERVAL '90 days';
$$;

REVOKE ALL ON FUNCTION public.prune_post_view_events() FROM public;

-- Best-effort nightly cleanup (pg_cron is already enabled by the first migration).
DO $$
BEGIN
  PERFORM cron.unschedule('prune-post-view-events');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('prune-post-view-events', '15 3 * * *', $$ SELECT public.prune_post_view_events(); $$);
