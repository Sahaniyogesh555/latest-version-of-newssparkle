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

  base := coalesce(base, 'https://ruusbjlabbojpbawbphc.supabase.co');

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

revoke all on function public.newsroom_trigger(text, jsonb, integer) from public;

-- Backwards compatibility with the Phase-5 helpers.
create or replace function public.trigger_auto_publish(slot text)
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.newsroom_trigger('auto-publish', jsonb_build_object('slot', slot));
$$;

create or replace function public.trigger_breaking_news_monitor()
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.newsroom_trigger('breaking-news-monitor', '{}'::jsonb, 120000);
$$;

create or replace function public.trigger_notifications_dispatcher()
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.newsroom_trigger('notifications-dispatcher', '{}'::jsonb, 60000);
$$;

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
-- ---------------------------------------------------------------------------
select cron.schedule('ingest-feeds', '*/20 * * * *',
  $$ select public.newsroom_trigger('ingest-feeds', '{}'::jsonb, 120000); $$);

select cron.schedule('write-desk', '*/30 * * * *',
  $$ select public.newsroom_trigger('write-desk', '{}'::jsonb, 300000); $$);

select cron.schedule('publish-scheduler', '*/10 * * * *',
  $$ select public.newsroom_trigger('publish-scheduler', '{}'::jsonb, 90000); $$);

select cron.schedule('trend-watch', '15 */3 * * *',
  $$ select public.newsroom_trigger('trend-watch', '{}'::jsonb, 120000); $$);

select cron.schedule('newsroom-maintenance', '40 * * * *',
  $$ select public.newsroom_trigger('maintenance', '{}'::jsonb, 240000); $$);

select cron.schedule('validate-feeds-daily', '30 4 * * *',
  $$ select public.newsroom_trigger('validate-feeds', '{}'::jsonb, 180000); $$);

-- Editions: the orchestrator ingests, writes to quota and spreads publishing
-- across the following hours.
select cron.schedule('auto-publish-morning', '0 6 * * *',
  $$ select public.trigger_auto_publish('morning'); $$);
select cron.schedule('auto-publish-midday', '0 12 * * *',
  $$ select public.trigger_auto_publish('midday'); $$);
select cron.schedule('auto-publish-evening', '0 18 * * *',
  $$ select public.trigger_auto_publish('evening'); $$);

-- Reader-facing alert pipelines (unchanged cadence, now secret-authenticated).
select cron.schedule('breaking-news-monitor', '*/30 * * * *',
  $$ select public.trigger_breaking_news_monitor(); $$);
select cron.schedule('notifications-dispatcher', '*/10 * * * *',
  $$ select public.trigger_notifications_dispatcher(); $$);

-- Newsroom health: an alarm that works even when nothing else does.
select cron.schedule('phase6-monitor', '5,35 * * * *',
  $$ select public.newsroom_trigger('phase6-monitor', '{}'::jsonb, 60000); $$);

-- Housekeeping
select cron.schedule('prune-post-view-events', '15 3 * * *',
  $$ select public.prune_post_view_events(); $$);
select cron.schedule('prune-automation', '25 3 * * *',
  $$ select public.prune_automation_tables(); $$);

-- ---------------------------------------------------------------------------
-- 4. Verification
--     select jobname, schedule, active from cron.job order by jobname;
--     select status, status_code, left(content, 160), created
--       from net._http_response order by created desc limit 20;
-- ---------------------------------------------------------------------------
