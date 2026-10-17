-- ============================================================================
-- PHASE 6 — Autonomous newsroom: schedules
--
-- One generic trigger keeps every job identical and secret-free: the shared
-- secret is read from Supabase Vault at run time, never from source control.
--
--   ingest-feeds        every 20 min   sourceless → candidates
--   write-desk          every 30 min   candidates → drafts → quality gate
--   publish-scheduler   every 10 min   scheduled posts → live (burst-limited)
--   trend-watch         every 3 hours  trend + gap signals
--   maintenance         hourly         health checks (deep pass at 02:xx)
--   validate-feeds      daily          feed format validation
--   auto-publish        3x daily       edition orchestrator (ingest→write→schedule)
--
-- FAIL CLOSED (audited Phase 6.1)
--
-- Eight of the jobs below can publish an article, spend LLM budget to queue
-- one, alert readers about one, or archive published content. They are created
-- INACTIVE so a fresh install has no window — not even a sub-second one — in
-- which such a job could run before the operator finishes the preflight in
-- phase6_activation_checklist.txt.
--
-- cron.schedule() always inserts a job active, so the gated jobs go through
-- cron.schedule_in_database(..., active := false): the row is born inactive
-- (pg_cron's ScheduleCronJob inserts the `active` argument exactly as given),
-- which makes the guarantee independent of statement or transaction
-- boundaries. See src/test/harness/cron-contract.ts for the canonical sets.
--
-- Gated (inactive):  write-desk, publish-scheduler, auto-publish-{morning,
--                    midday,evening}, breaking-news-monitor,
--                    notifications-dispatcher, newsroom-maintenance
-- Safe  (active):    ingest-feeds, trend-watch, phase6-monitor,
--                    validate-feeds-daily, prune-post-view-events,
--                    prune-automation
--
-- The canonical gate statement is repeated at the end of this file and in
-- 20261016090200_phase6_activation_gate.sql; src/test/phase6-sql.test.ts and
-- src/test/repo-integrity.test.ts assert that every copy is identical.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Generic authenticated trigger
-- ---------------------------------------------------------------------------
create or replace function public.newsroom_trigger(
  p_function text,
  p_body jsonb default '{}'::jsonb,
  p_timeout_ms integer default 150000
)
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  secret text;
  base   text;
  request_id bigint;
begin
  select decrypted_secret into secret
    from vault.decrypted_secrets
   where name = 'auto_publish_secret';

  select decrypted_secret into base
    from vault.decrypted_secrets
   where name = 'newsroom_base_url';

  -- FAIL CLOSED on the host. This used to fall back to a hard-coded project
  -- URL, which meant a project without the Vault row silently sent its cron
  -- traffic — with its own bearer token — to a different project. Guessing a
  -- host is never correct: refuse to run instead. See the operator checklist
  -- step C3 (the row is mandatory and is created before `db push`).
  if base is null or base !~ '^https://[A-Za-z0-9._:-]+/?$' then
    raise exception 'newsroom_base_url missing or invalid in Vault: refusing to send % to an unknown host', p_function;
  end if;

  -- Allow-list, not a concatenation. Only the functions this project actually
  -- schedules can be addressed; anything else is a bug or an attacker.
  if p_function not in (
    'ingest-feeds', 'write-desk', 'publish-scheduler', 'trend-watch',
    'maintenance', 'phase6-monitor', 'validate-feeds',
    'auto-publish', 'breaking-news-monitor', 'notifications-dispatcher'
  ) then
    raise exception 'newsroom_trigger: % is not an approved function', p_function;
  end if;

  if secret is null then
    raise warning 'auto_publish_secret missing from Vault — % will be rejected (401).', p_function;
  end if;

  select net.http_post(
    url := base || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(secret, '')
    ),
    body := coalesce(p_body, '{}'::jsonb),
    timeout_milliseconds := p_timeout_ms
  ) into request_id;

  return request_id;
end;
$$;

-- The trigger attaches the Vault automation secret and posts on behalf of
-- this project. pg_cron (postgres) is its only legitimate caller.
revoke all on function public.newsroom_trigger(text, jsonb, integer) from public, anon, authenticated, service_role;
grant execute on function public.newsroom_trigger(text, jsonb, integer) to postgres;

-- Backwards compatibility with the Phase-5 helpers.
create or replace function public.trigger_auto_publish(slot text)
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.newsroom_trigger('auto-publish', jsonb_build_object('slot', slot));
$$;

revoke all on function public.trigger_auto_publish(text) from public, anon, authenticated, service_role;
grant execute on function public.trigger_auto_publish(text) to postgres;

create or replace function public.trigger_breaking_news_monitor()
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.newsroom_trigger('breaking-news-monitor', '{}'::jsonb, 120000);
$$;

revoke all on function public.trigger_breaking_news_monitor() from public, anon, authenticated, service_role;
grant execute on function public.trigger_breaking_news_monitor() to postgres;

create or replace function public.trigger_notifications_dispatcher()
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.newsroom_trigger('notifications-dispatcher', '{}'::jsonb, 60000);
$$;

revoke all on function public.trigger_notifications_dispatcher() from public, anon, authenticated, service_role;
grant execute on function public.trigger_notifications_dispatcher() to postgres;

-- ---------------------------------------------------------------------------
-- 2. Replace the previous schedule
-- ---------------------------------------------------------------------------
do $$
declare
  job text;
begin
  foreach job in array array[
    'auto-publish-morning','auto-publish-midday','auto-publish-evening',
    'breaking-news-monitor','notifications-dispatcher','prune-post-view-events',
    'ingest-feeds','write-desk','publish-scheduler','trend-watch',
    'newsroom-maintenance','validate-feeds-daily','prune-automation','phase6-monitor'
  ]
  loop
    begin
      perform cron.unschedule(job);
    exception when others then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. The autonomous loop
--
-- Safe jobs use cron.schedule(); the gate set is created inactive with
-- cron.schedule_in_database(). Schedules and commands are unchanged.
-- ---------------------------------------------------------------------------
select cron.schedule('ingest-feeds', '*/20 * * * *',
  $$ select public.newsroom_trigger('ingest-feeds', '{}'::jsonb, 120000); $$);

select cron.schedule_in_database('write-desk', '*/30 * * * *',
  $$ select public.newsroom_trigger('write-desk', '{}'::jsonb, 300000); $$, current_database(), active := false);

select cron.schedule_in_database('publish-scheduler', '*/10 * * * *',
  $$ select public.newsroom_trigger('publish-scheduler', '{}'::jsonb, 90000); $$, current_database(), active := false);

select cron.schedule('trend-watch', '15 */3 * * *',
  $$ select public.newsroom_trigger('trend-watch', '{}'::jsonb, 120000); $$);

select cron.schedule_in_database('newsroom-maintenance', '40 * * * *',
  $$ select public.newsroom_trigger('maintenance', '{}'::jsonb, 240000); $$, current_database(), active := false);

select cron.schedule('validate-feeds-daily', '30 4 * * *',
  $$ select public.newsroom_trigger('validate-feeds', '{}'::jsonb, 180000); $$);

-- Editions: the orchestrator ingests, writes to quota and spreads publishing
-- across the following hours. Publishing-capable, so created inactive.
select cron.schedule_in_database('auto-publish-morning', '0 6 * * *',
  $$ select public.trigger_auto_publish('morning'); $$, current_database(), active := false);
select cron.schedule_in_database('auto-publish-midday', '0 12 * * *',
  $$ select public.trigger_auto_publish('midday'); $$, current_database(), active := false);
select cron.schedule_in_database('auto-publish-evening', '0 18 * * *',
  $$ select public.trigger_auto_publish('evening'); $$, current_database(), active := false);

-- Reader-facing alert pipelines (unchanged cadence, now secret-authenticated).
-- Gated: a test article must not be able to ping readers.
select cron.schedule_in_database('breaking-news-monitor', '*/30 * * * *',
  $$ select public.trigger_breaking_news_monitor(); $$, current_database(), active := false);
select cron.schedule_in_database('notifications-dispatcher', '*/10 * * * *',
  $$ select public.trigger_notifications_dispatcher(); $$, current_database(), active := false);

-- Newsroom health: an alarm that works even when nothing else does.
select cron.schedule('phase6-monitor', '5,35 * * * *',
  $$ select public.newsroom_trigger('phase6-monitor', '{}'::jsonb, 60000); $$);

-- ---------------------------------------------------------------------------
-- 3b. The gate — the canonical statement, repeated identically in
--     20261016090200_phase6_activation_gate.sql, 20261017090000_…, the
--     operator checklist and docs/OPERATIONS.md. It is a no-op on a fresh
--     install (the rows above are already inactive); it repairs a project
--     whose jobs were created active by an earlier revision of this file.
--
--     It uses cron.alter_job, not `update cron.job`: Supabase grants the
--     `postgres` role SELECT only on cron.job, so a direct UPDATE fails with
--     "permission denied for table job" and would abort the whole push here.
--     alter_job (pg_cron 1.4+) runs as the extension owner, changes only the
--     argument you pass, and is granted to `postgres` by Supabase.
-- ---------------------------------------------------------------------------
select cron.alter_job(jobid, active => false)
  from cron.job
 where jobname in ('write-desk','publish-scheduler',
                   'auto-publish-morning','auto-publish-midday','auto-publish-evening',
                   'breaking-news-monitor','notifications-dispatcher',
                   'newsroom-maintenance');

-- Housekeeping
select cron.schedule('prune-post-view-events', '15 3 * * *',
  $$ select public.prune_post_view_events(); $$);
select cron.schedule('prune-automation', '25 3 * * *',
  $$ select public.prune_automation_tables(); $$);

-- ---------------------------------------------------------------------------
-- 4. Verification
--     select jobname, schedule, active from cron.job order by jobname;
--       -> 14 rows: 8 inactive (the gate set) / 6 active (ingest-feeds,
--          trend-watch, phase6-monitor, validate-feeds-daily, both prunes)
--     select status, status_code, left(content, 160), created
--       from net._http_response order by created desc limit 20;
-- ---------------------------------------------------------------------------
