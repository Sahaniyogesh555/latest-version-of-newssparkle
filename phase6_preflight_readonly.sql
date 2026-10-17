-- ============================================================================
-- NewsSparkle Phase 6 — READ-ONLY preflight pack
--
-- Reviewed commit: 1da587211073264886f8fdbede3df79d689979e7
-- Companion report: phase6_preflight_audit.txt
--
-- SAFETY
--   * The whole pack runs inside a READ ONLY transaction and ends with
--     ROLLBACK. Any accidental write fails with
--     "cannot execute ... in a read-only transaction".
--   * It creates nothing, grants nothing, revokes nothing, and never touches
--     cron.job or cron.job_run_details: every cron query is a SELECT.
--   * Run it as the project owner (`postgres`) in the Supabase SQL editor and
--     paste the output into the audit report.
--
--   The cron inventory is printed with RAISE NOTICE because the job command
--   text of the legacy job contains an Authorization header. The pack never
--   prints it: any command containing "bearer" is replaced by "<redacted>".
-- ============================================================================

begin transaction read only;

-- ----------------------------------------------------------------------------
-- A. Identity and server
--    Expect: session_role = postgres, PostgreSQL 17.x on the target image.
-- ----------------------------------------------------------------------------
select current_user as session_role,
       session_user,
       current_database() as database,
       version() as server_version;

-- ----------------------------------------------------------------------------
-- B. Roles the chain grants/revokes against
--    Expect: anon, authenticated, service_role, postgres, supabase_admin exist.
--    (supabase_admin is the superuser; postgres is NOT a superuser.)
-- ----------------------------------------------------------------------------
select rolname, rolsuper, rolbypassrls
  from pg_roles
 where rolname in ('postgres', 'supabase_admin', 'anon', 'authenticated', 'service_role')
 order by 1;

-- ----------------------------------------------------------------------------
-- C. Extensions and their versions
--    Expect: pg_cron >= 1.4 (1.6.x on a current image), pg_net, pgcrypto.
--    A missing row means the chain will create it at push time, EXCEPT that
--    an existing pg_cron older than 1.4 breaks the first cron migration.
-- ----------------------------------------------------------------------------
select e.extname,
       e.extversion,
       n.nspname as schema,
       pg_get_userbyid(e.extowner) as owner
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
 where e.extname in ('pg_cron', 'pg_net', 'pgcrypto')
 order by 1;

-- ----------------------------------------------------------------------------
-- D. The cron API the chain depends on
--    Expect: alter_job(bigint,text,text,text,text,boolean) present,
--            schedule_in_database(text,text,text,text,text,boolean) present,
--            both owned by the extension owner (usually supabase_admin).
-- ----------------------------------------------------------------------------
select coalesce(
         to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)')::text,
         'MISSING'
       ) as alter_job,
       coalesce(
         to_regprocedure('cron.schedule_in_database(text,text,text,text,text,boolean)')::text,
         'MISSING'
       ) as schedule_in_database;

select p.oid::regprocedure::text as signature,
       pg_get_userbyid(p.proowner) as owner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'cron'
 order by 1;

-- ----------------------------------------------------------------------------
-- E. Can the migration role call them?
--    Expect: both true. If either is false, `db push` fails at the first cron
--    statement with "permission denied for function ...".
--    The WHERE guard keeps this query valid on a project without pg_cron.
-- ----------------------------------------------------------------------------
select has_function_privilege(
         'postgres',
         'cron.alter_job(bigint,text,text,text,text,boolean)',
         'EXECUTE'
       ) as postgres_can_alter_job,
       has_function_privilege(
         'postgres',
         'cron.schedule_in_database(text,text,text,text,text,boolean)',
         'EXECUTE'
       ) as postgres_can_schedule_in_database,
       (select pg_get_userbyid(extowner)
          from pg_extension where extname = 'pg_cron') as pg_cron_owner
 where to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)') is not null
   and to_regprocedure('cron.schedule_in_database(text,text,text,text,text,boolean)') is not null;

-- Which roles hold EXECUTE on the two functions, and how (direct grant, not
-- inheritance from PUBLIC, because pg_cron revokes them from PUBLIC).
select p.oid::regprocedure::text as signature,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       a.is_grantable as with_grant_option
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
 where n.nspname = 'cron'
   and p.proname in ('alter_job', 'schedule_in_database')
   and a.privilege_type = 'EXECUTE'
 order by 1, 2;

-- ----------------------------------------------------------------------------
-- F. Dependencies used by the chain at run time (not at push time)
--    Expect: the Vault view readable by postgres, the Vault RPCs executable,
--            net.http_post present and executable by postgres.
-- ----------------------------------------------------------------------------
select coalesce(to_regclass('vault.decrypted_secrets')::text, 'MISSING') as vault_decrypted_secrets,
       coalesce(to_regprocedure('vault.create_secret(text,text,text)')::text, 'MISSING') as vault_create_secret,
       coalesce(to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)')::text, 'MISSING') as net_http_post;

select has_table_privilege('postgres', 'vault.decrypted_secrets', 'SELECT') as postgres_can_read_vault,
       has_function_privilege('postgres', 'net.http_post(text,jsonb,jsonb,jsonb,integer)', 'EXECUTE') as postgres_can_post
 where to_regclass('vault.decrypted_secrets') is not null
   and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null;

-- Publications the historical migration 20260507084537 adds to.
select pubname from pg_publication where pubname = 'supabase_realtime';

-- ----------------------------------------------------------------------------
-- G. Cron inventory — READ ONLY. 8 gated inactive + 6 safe active expected on
--    a completed fresh install; anything else is drift to explain.
--    Commands that contain an Authorization header are redacted here.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
  total integer := 0;
  active_count integer := 0;
begin
  if to_regclass('cron.job') is null then
    raise notice 'cron.job: ABSENT (pg_cron not installed)';
    return;
  end if;

  for r in execute $q$
    select jobid,
           coalesce(jobname, '(unnamed)') as jobname,
           schedule,
           username,
           active,
           case when command ilike '%bearer%' then '<redacted: contains Authorization header>'
                else left(command, 70) end as command_preview
      from cron.job
     order by jobname nulls last, jobid
  $q$ loop
    raise notice 'job % | % | % | user=% | active=% | %',
      r.jobid, r.jobname, r.schedule, r.username, r.active, r.command_preview;
    total := total + 1;
    if r.active then active_count := active_count + 1; end if;
  end loop;

  raise notice 'cron.job: % rows, % active, % inactive', total, active_count, total - active_count;
end $$;

-- ----------------------------------------------------------------------------
-- H. Effective EXECUTE on every SECURITY DEFINER function in public
--    Expected end state after the full chain:
--      anon/authenticated -> increment_post_views(text,text) only
--      service_role       -> the data RPCs + both prunes + increment_post_views
--      postgres           -> everything it owns (implicit) + the trigger set
--      PUBLIC             -> nothing
-- ----------------------------------------------------------------------------
select p.oid::regprocedure::text as signature,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
 where n.nspname = 'public'
   and p.prosecdef
   and a.privilege_type = 'EXECUTE'
 order by 1, 2;

-- Whole-catalog sweep: anything reachable by the public roles that is not the
-- view counter is a finding.
select p.oid::regprocedure::text as exposed_to_public
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.prosecdef
   and (has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
 order by 1;

-- ----------------------------------------------------------------------------
-- I. Presence of the objects the chain creates
--    All-null means the project has never been migrated with this chain.
-- ----------------------------------------------------------------------------
select t.name,
       case when to_regclass('public.' || t.name) is null then 'MISSING' else 'present' end as state
  from (values
    ('posts'), ('categories'), ('notifications'), ('feed_validation_runs'),
    ('post_view_events'), ('ingested_items'), ('pipeline_runs'), ('agent_alerts'),
    ('content_sources'), ('content_health_checks'), ('topic_trends')
  ) as t(name);

select f.signature,
       case when to_regprocedure(f.signature) is null then 'MISSING' else 'present' end as state
  from (values
    ('public.increment_post_views(text,text)'),
    ('public.touch_updated_at()'),
    ('public.prune_post_view_events()'),
    ('public.record_alert(text,text,text,text,jsonb)'),
    ('public.claim_ingested_items(integer)'),
    ('public.category_published_count(text,timestamptz)'),
    ('public.newsroom_llm_calls_today()'),
    ('public.newsroom_status()'),
    ('public.prune_automation_tables()'),
    ('public.newsroom_trigger(text,jsonb,integer)'),
    ('public.trigger_auto_publish(text)'),
    ('public.trigger_breaking_news_monitor()'),
    ('public.trigger_notifications_dispatcher()')
  ) as f(signature);

-- ----------------------------------------------------------------------------
-- J. Migration bookkeeping (present only if the project was pushed with the CLI)
--    Compare the list with the 14 filenames in supabase/migrations/.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
  n integer := 0;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'schema_migrations: ABSENT (no CLI migration history; project never pushed)';
    return;
  end if;

  for r in execute 'select version, name from supabase_migrations.schema_migrations order by version' loop
    raise notice 'applied % | %', r.version, coalesce(r.name, '');
    n := n + 1;
  end loop;

  raise notice 'schema_migrations: % rows', n;
end $$;

rollback;
