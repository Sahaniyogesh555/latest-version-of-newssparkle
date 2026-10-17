-- ============================================================================
-- PHASE 6.1 — Privilege repair + gate repair (corrective, idempotent)
--
-- Three defects found in the Phase 0 audit (commit 435ffd3), all of which only
-- manifest on a real Supabase project:
--
--   F1  The activation gate was `update cron.job set active = …`. Supabase
--       grants the `postgres` role SELECT only on cron.job, so that statement
--       fails with "permission denied for table job". This file closes the gate
--       with cron.alter_job instead, for projects that already applied
--       20261016090100 / 20261016090200 (their contents are fixed as well, for
--       fresh installs).
--
--   F2  Every privileged function was REVOKEd from PUBLIC only, while Supabase
--       grants EXECUTE to anon/authenticated/service_role by default at
--       creation (init-scripts/00000000000000-initial-schema.sql:41). On a real
--       project the publishing triggers — and the Vault-secret-bearing
--       newsroom_trigger — were therefore callable with the public anon key.
--       This file revokes anon/authenticated explicitly and grants each
--       function only to the role that actually calls it.
--
--   F3  newsroom_trigger fell back to a hard-coded project URL when the Vault
--       row was missing. This file replaces the function with the fail-closed
--       version (the body is kept identical to 20261016090100; a test asserts
--       that the two copies match).
--
-- Idempotent: re-running it changes nothing. It never enables a job, never
-- changes a schedule, and never touches a table.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Close the gate (same canonical statement as 20261016090100 §3b)
--    alter_job only changes the argument supplied, so schedules survive.
-- ---------------------------------------------------------------------------
select cron.alter_job(jobid, active => false)
  from cron.job
 where jobname in ('write-desk','publish-scheduler',
                   'auto-publish-morning','auto-publish-midday','auto-publish-evening',
                   'breaking-news-monitor','notifications-dispatcher',
                   'newsroom-maintenance');

-- ---------------------------------------------------------------------------
-- 2. Function privileges: least privilege, explicitly per role.
--
--    Supabase's default privileges give table/function ALL to
--    postgres, anon, authenticated and service_role at creation time. A
--    `revoke … from public` does NOT undo those per-role grants, so every
--    function below is revoked from anon, authenticated AND service_role by
--    name, and only the roles that genuinely call it get EXECUTE back.
--
--    Roles and why:
--      anon, authenticated  the public site. Only the view counter.
--      service_role         the edge functions (they hold the service key).
--      postgres             pg_cron runs as this role; it also owns the
--                           functions, so these grants are documentation of
--                           intent rather than a new capability.
--
--    Nothing is granted to PUBLIC anywhere.
-- ---------------------------------------------------------------------------

-- The public read path: a reader may bump a view counter, and nothing else.
revoke all on function public.increment_post_views(text) from public, anon, authenticated, service_role;
revoke all on function public.increment_post_views(text, text) from public, anon, authenticated, service_role;
grant execute on function public.increment_post_views(text) to anon, authenticated, service_role;
grant execute on function public.increment_post_views(text, text) to anon, authenticated, service_role;

-- Trigger helper: never callable through PostgREST.
revoke all on function public.touch_updated_at() from public, anon, authenticated, service_role;

-- Retention: runs from pg_cron (postgres) and may be called by the monitor.
revoke all on function public.prune_post_view_events() from public, anon, authenticated, service_role;
grant execute on function public.prune_post_view_events() to postgres, service_role;

revoke all on function public.prune_automation_tables() from public, anon, authenticated, service_role;
grant execute on function public.prune_automation_tables() to postgres, service_role;

-- Data RPCs used by the edge functions with the service key.
revoke all on function public.record_alert(text, text, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.record_alert(text, text, text, text, jsonb) to service_role;

revoke all on function public.claim_ingested_items(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_ingested_items(integer) to service_role;

revoke all on function public.category_published_count(text, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.category_published_count(text, timestamptz) to service_role;

revoke all on function public.newsroom_llm_calls_today() from public, anon, authenticated, service_role;
grant execute on function public.newsroom_llm_calls_today() to service_role;

revoke all on function public.newsroom_status() from public, anon, authenticated, service_role;
grant execute on function public.newsroom_status() to service_role;

-- HTTP triggers: pg_cron only. Deliberately NOT granted to service_role —
-- an edge function has no business making the database send a request that
-- carries the Vault automation secret.
revoke all on function public.newsroom_trigger(text, jsonb, integer) from public, anon, authenticated, service_role;
grant execute on function public.newsroom_trigger(text, jsonb, integer) to postgres;

revoke all on function public.trigger_auto_publish(text) from public, anon, authenticated, service_role;
grant execute on function public.trigger_auto_publish(text) to postgres;

revoke all on function public.trigger_breaking_news_monitor() from public, anon, authenticated, service_role;
grant execute on function public.trigger_breaking_news_monitor() to postgres;

revoke all on function public.trigger_notifications_dispatcher() from public, anon, authenticated, service_role;
grant execute on function public.trigger_notifications_dispatcher() to postgres;

-- ---------------------------------------------------------------------------
-- 3. newsroom_trigger: no host fallback, plus a real allow-list (F3).
--    Kept byte-identical (after whitespace normalisation) to the definition in
--    20261016090100; src/test/phase6-sql.test.ts asserts that.
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

revoke all on function public.newsroom_trigger(text, jsonb, integer) from public, anon, authenticated, service_role;
grant execute on function public.newsroom_trigger(text, jsonb, integer) to postgres;

-- ---------------------------------------------------------------------------
-- Verification (run on the project after `db push`)
--
--   8 of 14 jobs inactive (gated) / 6 active (safe)
--     select jobname, schedule, active from cron.job order by jobname;
--
--   No public function may be executable by the public roles, except the
--   view counter (expected: exactly one row, increment_post_views).
--     select p.proname,
--            has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
--            has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
--       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.prosecdef
--      order by 1;
--
--   The trigger refuses to run without the host:
--     select public.newsroom_trigger('write-desk');   -- raises, by design
-- ---------------------------------------------------------------------------
