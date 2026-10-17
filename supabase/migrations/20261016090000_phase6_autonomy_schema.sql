-- ============================================================================
-- PHASE 6 — Autonomous newsroom: schema
--
-- Adds the data model the automation needs to run unattended:
--   * content_sources      – registry of feeds with trust tier + health
--   * ingested_items       – raw candidates, deduplicated at insert time
--   * topic_trends         – trend + content-gap watchlist
--   * publish windows      – scheduling columns on posts
--   * pipeline_runs        – per-run telemetry + cost accounting
--   * agent_alerts         – failures that need a human (eventually)
--   * content_health_checks– maintenance findings
--   * helper RPCs          – claim/queue/budget/status
--
-- Design notes
--   * posts stays the single content table; new statuses
--     ('draft','review','scheduled','published','rejected','archived') are all
--     hidden from the public by the existing RLS policy (status='published').
--   * Nothing in here is readable by anon/authenticated: the whole automation
--     surface is service-role only.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Source registry
-- ---------------------------------------------------------------------------
create table if not exists public.content_sources (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  url                   text not null,
  kind                  text not null default 'rss'
                          check (kind in ('rss','trends','api')),
  category_slug         text references public.categories(slug) on delete set null,
  -- 1 = wires/major outlets, 2 = established trade press, 3 = specialist/blogs
  trust_tier            integer not null default 2 check (trust_tier between 1 and 3),
  language              text not null default 'en',
  active                boolean not null default true,
  notes                 text,
  last_success_at       timestamptz,
  last_failure_at       timestamptz,
  consecutive_failures  integer not null default 0,
  items_seen            integer not null default 0,
  disabled_until        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint content_sources_url_key unique (url)
);

create index if not exists idx_content_sources_active
  on public.content_sources (active, disabled_until);

drop trigger if exists content_sources_touch on public.content_sources;
create trigger content_sources_touch before update on public.content_sources
  for each row execute function public.touch_updated_at();

alter table public.content_sources enable row level security;
revoke all on public.content_sources from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ingested candidates
--    fingerprint = hash of the normalised headline, so the same story arriving
--    from several feeds collapses into one row and gains corroboration.
-- ---------------------------------------------------------------------------
create table if not exists public.ingested_items (
  id              uuid primary key default gen_random_uuid(),
  fingerprint     text not null,
  simhash         bigint,
  title           text not null,
  url             text,
  snippet         text,
  source_id       uuid references public.content_sources(id) on delete set null,
  source_name     text not null default 'unknown',
  trust_tier      integer not null default 2,
  corroboration   integer not null default 1,
  corroborating   jsonb not null default '[]'::jsonb,
  category_slug   text,
  category_confidence numeric(4,3),
  category_method text,
  language        text not null default 'en',
  published_at    timestamptz,
  status          text not null default 'new'
                    check (status in ('new','processing','used','rejected','expired')),
  reject_reason   text,
  attempts        integer not null default 0,
  next_attempt_at timestamptz,
  last_error      text,
  trend_score     numeric(6,3) not null default 0,
  seen_at         timestamptz not null default now(),
  processed_at    timestamptz,
  expires_at      timestamptz not null default (now() + interval '36 hours'),
  constraint ingested_items_fingerprint_key unique (fingerprint)
);

create index if not exists idx_ingested_items_queue
  on public.ingested_items (status, next_attempt_at, trust_tier, published_at desc);
create index if not exists idx_ingested_items_category
  on public.ingested_items (category_slug, status);
create index if not exists idx_ingested_items_expiry
  on public.ingested_items (expires_at);

alter table public.ingested_items enable row level security;
revoke all on public.ingested_items from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. posts — scheduling, quality and provenance columns
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists quality_score      integer,
  add column if not exists quality_report     jsonb,
  add column if not exists dedupe_fingerprint text,
  add column if not exists simhash            bigint,
  add column if not exists word_count         integer,
  add column if not exists review_reason      text,
  add column if not exists scheduled_for      timestamptz,
  add column if not exists published_by       text not null default 'human',
  add column if not exists ai_model           text,
  add column if not exists source_refs        jsonb not null default '[]'::jsonb,
  add column if not exists image_credit       text,
  add column if not exists image_credit_url   text,
  add column if not exists source_category    text,
  add column if not exists attempts           integer not null default 0,
  add column if not exists last_error         text,
  add column if not exists next_attempt_at    timestamptz,
  add column if not exists archived_at        timestamptz;

-- status now carries the editorial lifecycle as well as visibility
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add constraint posts_status_check
  check (status in ('draft','review','scheduled','published','rejected','archived'));

create index if not exists idx_posts_schedule
  on public.posts (scheduled_for) where status = 'scheduled';
create index if not exists idx_posts_review
  on public.posts (created_at desc) where status = 'review';
create index if not exists idx_posts_published_category_day
  on public.posts (category_slug, published_at desc) where status = 'published';
create index if not exists idx_posts_dedupe
  on public.posts (dedupe_fingerprint) where dedupe_fingerprint is not null;

-- ---------------------------------------------------------------------------
-- 4. Trend watchlist
-- ---------------------------------------------------------------------------
create table if not exists public.topic_trends (
  id            uuid primary key default gen_random_uuid(),
  topic         text not null,
  topic_key     text not null,
  category_slug text,
  score         numeric(8,3) not null default 0,
  source        text not null default 'trends',
  evidence      jsonb not null default '{}'::jsonb,
  detected_at   timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  used_at       timestamptz,
  constraint topic_trends_key unique (topic_key, category_slug)
);

create index if not exists idx_topic_trends_live
  on public.topic_trends (score desc, expires_at desc);

alter table public.topic_trends enable row level security;
revoke all on public.topic_trends from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Pipeline telemetry
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  function     text not null,
  edition      text,
  ok           boolean not null default true,
  items_in     integer not null default 0,
  items_out    integer not null default 0,
  llm_calls    integer not null default 0,
  duration_ms  integer,
  metrics      jsonb not null default '{}'::jsonb,
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists idx_pipeline_runs_recent
  on public.pipeline_runs (started_at desc);
create index if not exists idx_pipeline_runs_function
  on public.pipeline_runs (function, started_at desc);

alter table public.pipeline_runs enable row level security;
revoke all on public.pipeline_runs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Operator alerts (deduplicated by code + subject for the day)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_alerts (
  id           uuid primary key default gen_random_uuid(),
  severity     text not null default 'warning'
                 check (severity in ('info','warning','critical')),
  code         text not null,
  subject      text,
  message      text not null,
  context      jsonb not null default '{}'::jsonb,
  alert_day    date not null default ((now() at time zone 'utc')::date),
  occurrences  integer not null default 1,
  acknowledged_at timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint agent_alerts_dedupe unique (code, subject, alert_day)
);

create index if not exists idx_agent_alerts_open
  on public.agent_alerts (severity, created_at desc) where resolved_at is null;

drop trigger if exists agent_alerts_touch on public.agent_alerts;
create trigger agent_alerts_touch before update on public.agent_alerts
  for each row execute function public.touch_updated_at();

alter table public.agent_alerts enable row level security;
revoke all on public.agent_alerts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Maintenance findings
-- ---------------------------------------------------------------------------
create table if not exists public.content_health_checks (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  ok          boolean not null default true,
  checked     integer not null default 0,
  findings    jsonb not null default '[]'::jsonb,
  counts      jsonb not null default '{}'::jsonb,
  duration_ms integer,
  created_at  timestamptz not null default now()
);

create index if not exists idx_content_health_recent
  on public.content_health_checks (created_at desc);

alter table public.content_health_checks enable row level security;
revoke all on public.content_health_checks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- PRIVILEGES (least privilege, applied at creation time)
--
-- Supabase's default privileges grant EXECUTE on every new function in public
-- to anon, authenticated and service_role, so `revoke ... from public` alone
-- does NOT undo them. Each function below is revoked from all four roles and
-- granted back only to the role that genuinely calls it. This happens in the
-- same migration that creates the function, so no later `db push` boundary
-- leaves a privileged RPC reachable with the public anon key.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 8. Alert helper — dedupe + count occurrences in one call
-- ---------------------------------------------------------------------------
create or replace function public.record_alert(
  p_code text,
  p_message text,
  p_severity text default 'warning',
  p_subject text default null,
  p_context jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.agent_alerts (severity, code, subject, message, context)
  values (p_severity, p_code, coalesce(p_subject, ''), p_message, p_context)
  on conflict (code, subject, alert_day) do update
    set occurrences = agent_alerts.occurrences + 1,
        message     = excluded.message,
        severity    = excluded.severity,
        context     = excluded.context,
        updated_at  = now();
$$;

revoke all on function public.record_alert(text, text, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.record_alert(text, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Candidate claiming — atomic, skip-locked, so overlapping runs (manual
--    trigger + cron) can never write the same story twice.
-- ---------------------------------------------------------------------------
create or replace function public.claim_ingested_items(p_limit integer default 5)
returns setof public.ingested_items
language sql
security definer
set search_path = public
as $$
  with claimed as (
    select id
      from public.ingested_items
     where status = 'new'
       and expires_at > now()
       and (next_attempt_at is null or next_attempt_at <= now())
     order by trend_score desc, trust_tier asc, corroboration desc, published_at desc nulls last
     limit greatest(p_limit, 1)
     for update skip locked
  )
  update public.ingested_items i
     set status = 'processing',
         attempts = i.attempts + 1,
         processed_at = now()
    from claimed
   where i.id = claimed.id
  returning i.*;
$$;

revoke all on function public.claim_ingested_items(integer) from public, anon, authenticated, service_role;
grant execute on function public.claim_ingested_items(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Publishing plan helpers
-- ---------------------------------------------------------------------------

-- How many posts have gone out (or are queued) for a category on a given day.
create or replace function public.category_published_count(
  p_category text,
  p_since timestamptz default (date_trunc('day', now() at time zone 'utc'))
) returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.posts
   where category_slug = p_category
     and status in ('published','scheduled')
     and coalesce(published_at, scheduled_for) >= p_since;
$$;

revoke all on function public.category_published_count(text, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.category_published_count(text, timestamptz) to service_role;

-- LLM spend guard: how many AI calls the newsroom has made today.
create or replace function public.newsroom_llm_calls_today()
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(llm_calls), 0)::integer
    from public.pipeline_runs
   where started_at >= date_trunc('day', now() at time zone 'utc');
$$;

revoke all on function public.newsroom_llm_calls_today() from public, anon, authenticated, service_role;
grant execute on function public.newsroom_llm_calls_today() to service_role;

-- Single JSON snapshot used by the monitoring endpoint and dashboards.
create or replace function public.newsroom_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'posts', jsonb_build_object(
      'published_24h', (select count(*) from public.posts
                         where status = 'published' and published_at >= now() - interval '24 hours'),
      'published_total', (select count(*) from public.posts where status = 'published'),
      'scheduled', (select count(*) from public.posts where status = 'scheduled'),
      'review', (select count(*) from public.posts where status = 'review'),
      'rejected_24h', (select count(*) from public.posts
                        where status = 'rejected' and updated_at >= now() - interval '24 hours'),
      'last_published_at', (select max(published_at) from public.posts where status = 'published')
    ),
    'candidates', jsonb_build_object(
      'new', (select count(*) from public.ingested_items where status = 'new' and expires_at > now()),
      'processing', (select count(*) from public.ingested_items where status = 'processing'),
      'rejected_24h', (select count(*) from public.ingested_items
                        where status = 'rejected' and processed_at >= now() - interval '24 hours')
    ),
    'sources', jsonb_build_object(
      'active', (select count(*) from public.content_sources where active and (disabled_until is null or disabled_until < now())),
      'degraded', (select count(*) from public.content_sources where consecutive_failures > 0),
      'disabled', (select count(*) from public.content_sources where disabled_until > now())
    ),
    'alerts', jsonb_build_object(
      'open', (select count(*) from public.agent_alerts where resolved_at is null),
      'critical_open', (select count(*) from public.agent_alerts where resolved_at is null and severity = 'critical'),
      'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                    'code', code, 'severity', severity, 'message', message,
                    'occurrences', occurrences, 'at', updated_at) order by updated_at desc), '[]'::jsonb)
                 from (select * from public.agent_alerts
                        where resolved_at is null order by updated_at desc limit 10) a)
    ),
    'llm', jsonb_build_object(
      'calls_today', public.newsroom_llm_calls_today()
    ),
    'pipeline', jsonb_build_object(
      'runs_24h', (select count(*) from public.pipeline_runs where started_at >= now() - interval '24 hours'),
      'failures_24h', (select count(*) from public.pipeline_runs
                        where started_at >= now() - interval '24 hours' and not ok),
      'last_success_at', (select max(finished_at) from public.pipeline_runs where ok)
    ),
    'trends', jsonb_build_object(
      'live', (select count(*) from public.topic_trends where expires_at > now())
    )
  );
$$;

revoke all on function public.newsroom_status() from public, anon, authenticated, service_role;
grant execute on function public.newsroom_status() to service_role;

-- ---------------------------------------------------------------------------
-- 11. Retention — keep the operational tables from growing forever.
-- ---------------------------------------------------------------------------
create or replace function public.prune_automation_tables()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ingested_items
   where expires_at < now() - interval '7 days';
  delete from public.pipeline_runs
   where started_at < now() - interval '30 days';
  delete from public.content_health_checks
   where created_at < now() - interval '30 days';
  delete from public.agent_alerts
   where resolved_at is not null and resolved_at < now() - interval '60 days';
  delete from public.topic_trends
   where expires_at < now() - interval '7 days';
$$;

revoke all on function public.prune_automation_tables() from public, anon, authenticated, service_role;
grant execute on function public.prune_automation_tables() to postgres, service_role;

-- ---------------------------------------------------------------------------
-- 12. Seed the source registry
--     Trust tiers: 1 = wires/major international, 2 = established trade press,
--     3 = specialist/blogs. Category hints are starting points; the classifier
--     decides the final section.
-- ---------------------------------------------------------------------------
insert into public.content_sources (name, url, kind, category_slug, trust_tier, language, notes)
values
  ('BBC News — World',        'https://feeds.bbci.co.uk/news/world/rss.xml',             'rss', 'breaking-news', 1, 'en', 'Wire-grade general news'),
  ('BBC News — Technology',   'https://feeds.bbci.co.uk/news/technology/rss.xml',        'rss', 'technology',    1, 'en', null),
  ('NPR News',                'https://feeds.npr.org/1001/rss.xml',                      'rss', 'breaking-news', 1, 'en', null),
  ('NPR Politics',            'https://feeds.npr.org/1014/rss.xml',                      'rss', 'politics',      1, 'en', null),
  ('AP — Top News',           'https://apnews.com/hub/ap-top-news/rss',                  'rss', 'breaking-news', 1, 'en', null),
  ('Reuters — World',         'https://www.reutersagency.com/feed/?best-topics=world',   'rss', 'breaking-news', 1, 'en', 'Feed availability varies by region'),
  ('Google News — General',   'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',   'rss', 'breaking-news', 2, 'en', 'Aggregator'),
  ('Google News — Business',  'https://news.google.com/rss/search?q=business+economy+when:1d&hl=en-US&gl=US&ceid=US:en', 'rss', 'business', 2, 'en', 'Aggregator'),
  ('Google News — Health',    'https://news.google.com/rss/search?q=health+research+when:1d&hl=en-US&gl=US&ceid=US:en', 'rss', 'health', 2, 'en', 'Aggregator'),
  ('CNBC — Business',         'https://www.cnbc.com/id/10001147/device/rss/rss.html',    'rss', 'business',      2, 'en', null),
  ('Yahoo Finance',           'https://finance.yahoo.com/news/rssindex',                 'rss', 'business',      2, 'en', null),
  ('TechCrunch',              'https://techcrunch.com/feed/',                            'rss', 'technology',    2, 'en', null),
  ('The Verge',               'https://www.theverge.com/rss/index.xml',                  'rss', 'technology',    2, 'en', null),
  ('Ars Technica',            'https://feeds.arstechnica.com/arstechnica/index',         'rss', 'technology',    2, 'en', null),
  ('Wired',                   'https://www.wired.com/feed/rss',                          'rss', 'technology',    2, 'en', null),
  ('WHO — Disease Outbreaks', 'https://www.who.int/feeds/entity/csr/don/en/rss.xml',     'rss', 'health',        1, 'en', 'Primary source'),
  ('Medical News Today',      'https://www.medicalnewstoday.com/rss',                    'rss', 'health',        2, 'en', null),
  ('BBC News — Health',       'https://feeds.bbci.co.uk/news/health/rss.xml',            'rss', 'health',        1, 'en', null),
  ('Variety',                 'https://variety.com/feed/',                               'rss', 'entertainment', 2, 'en', null),
  ('Billboard',               'https://www.billboard.com/feed/',                         'rss', 'entertainment', 2, 'en', null),
  ('Deadline',                'https://deadline.com/feed/',                              'rss', 'entertainment', 2, 'en', null),
  ('BBC Sport',               'https://feeds.bbci.co.uk/sport/rss.xml',                  'rss', 'sports',       1, 'en', null),
  ('ESPN',                    'https://www.espn.com/espn/rss/news',                      'rss', 'sports',       2, 'en', null),
  ('Google Trends — US',      'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US', 'trends', null, 2, 'en', 'Trend signal, not a story source')
on conflict (url) do nothing;

-- Keep the categories the newsroom can target in one place. 'world' and
-- 'sports' already exist from the original seed and are used by the classifier
-- for global and sports stories.
insert into public.categories (name, slug, description, color)
values ('World', 'world', 'Global affairs, geopolitics and international events.', '#dc2626')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 13. Verification
--     select public.newsroom_status();
--     select count(*) from public.content_sources;
-- ---------------------------------------------------------------------------
