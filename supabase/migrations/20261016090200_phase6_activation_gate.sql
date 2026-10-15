-- ============================================================================
-- PHASE 6 — Activation gate (repair)
--
-- Why this file exists
--
-- The first revision of 20261016090100_phase6_autonomy_crons.sql created all
-- 14 jobs ACTIVE. Supabase records applied migrations and never re-runs them,
-- so editing that file is not enough for a project that has already pushed it:
-- such a project would keep a live publisher until an operator noticed.
--
-- This migration closes the gate once, idempotently, for that case. On a fresh
-- install it is a no-op, because 20261016090100 already creates the gate set
-- inactive.
--
-- What it does NOT do: it never enables anything, never changes a schedule or a
-- command, and never touches the six jobs that are safe to run unattended.
--
-- Gated (set inactive here): the jobs that can publish an article, spend LLM
-- budget to queue one, alert readers about one, or archive published content.
--
-- After this runs, the state the checklist expects is:
--   8 of 14 jobs inactive (gated) / 6 active (safe)
--
-- Re-running it is free: the statement is idempotent.
-- ============================================================================

update cron.job set active = false
 where jobname in ('write-desk','publish-scheduler',
                   'auto-publish-morning','auto-publish-midday','auto-publish-evening',
                   'breaking-news-monitor','notifications-dispatcher',
                   'newsroom-maintenance');

-- ---------------------------------------------------------------------------
-- Verification
--     select jobname, schedule, active from cron.job order by jobname;
--       -> 14 rows: 8 inactive / 6 active
--     select count(*) filter (where active) as active,
--            count(*) filter (where not active) as inactive
--       from cron.job;
--       -> active 6, inactive 8
-- ---------------------------------------------------------------------------
