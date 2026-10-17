# Operations

Everything an operator needs to deploy, configure and run NewsSparkle.

---

## 1. Deploy checklist

```bash
# 1. Front end
npm ci && npm run verify            # typecheck + lint + test + build
# deploy `dist/` to the host (Lovable / Vercel / Netlify / Cloudflare Pages)

# 2. Database
supabase link --project-ref xuqxautmflofkvbsaanh    # the NewsSparkle project (ap-south-1)
supabase db push                    # applies supabase/migrations (14 files)

# 3. Functions
npm run check:functions             # real `deno check` on every entrypoint
                                    # (skipped when deno is not installed)
supabase functions deploy           # deploys every function in supabase/config.toml
```

Before `supabase db push` runs against a live project, the migrations can be
replayed locally against a real PostgreSQL (WASM) engine:

```bash
npx vitest run src/test/phase6-sql.test.ts
```

That applies `supabase/migrations/*.sql` in order and asserts the resulting
schema, RLS state, RPCs and the 14 cron jobs — the same SQL that `db push`
sends, minus the platform-only extensions (pg_cron / pg_net / pgcrypto).


### Hosting requirements

The front end is a single-page app. Whatever host serves it **must** rewrite
unknown paths to `/index.html`, otherwise deep links such as
`/post/<slug>` return a 404 on refresh. Examples:

```
# Netlify  (public/_redirects)
/*    /index.html   200

# Vercel   (vercel.json)
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

The sitemap and feeds live on the Supabase domain and need no host rewrite:

| Endpoint | URL |
| --- | --- |
| Sitemap index | `https://<project-ref>.supabase.co/functions/v1/sitemap` |
| Google News sitemap | `https://<project-ref>.supabase.co/functions/v1/news-sitemap` |
| RSS | `https://<project-ref>.supabase.co/functions/v1/rss` |

---

## 2. Secrets

### Generated automation secret

Every automation endpoint rejects unauthenticated calls: `auto-publish`,
`breaking-news-monitor`, `notifications-dispatcher`, `validate-feeds` and the
Phase 6 newsroom functions (`ingest-feeds`, `write-desk`, `publish-scheduler`,
`trend-watch`, `maintenance`, `phase6-monitor`). They accept
`Authorization: Bearer <secret>`, `x-cron-secret: <secret>`, or the service-role
key.

The same secret has to exist in **two** places, because pg_cron runs inside the
database:

```bash
# a) Vault (read by the trigger functions at run time)
openssl rand -hex 32          # keep the value
# SQL editor:
#   select vault.create_secret('<value>', 'auto_publish_secret', 'NewsSparkle automation');

# b) Function secrets
supabase secrets set AUTO_PUBLISH_SECRET=<same value>
supabase secrets set SITE_URL=https://newssparkle.lovable.app
supabase secrets set LOVABLE_API_KEY=<AI gateway key>
supabase secrets set GNEWS_API_KEY=<optional>
supabase secrets set NEWSAPI_KEY=<optional>
supabase secrets set SERPAPI_KEY=<optional>
supabase secrets set UNSPLASH_ACCESS_KEY=<optional: topic-relevant images>
supabase secrets set PEXELS_API_KEY=<optional: image fallback>
```

### Second Vault entry: the newsroom base URL

The Phase 6 cron wrappers build their function URL from Vault, so the database
never has to hard-code a host. **This row is required** — create it before the
first `db push` for a new project:

```sql
select vault.create_secret('https://xuqxautmflofkvbsaanh.supabase.co', 'newsroom_base_url',
                           'NewsSparkle automation host');
```

There is no fallback. A missing or non-https value makes `newsroom_trigger`
raise and send nothing, which is the correct failure mode: the previous
fallback silently sent one project's cron traffic, with its bearer token, to a
different project. The function name is also checked against an allow-list, so
a typo cannot address an arbitrary endpoint.

Both names are read on every run:

| Vault name | Used for | If it is missing |
| --- | --- | --- |
| `auto_publish_secret` | `Authorization: Bearer` header | cron calls return **401** and log a warning |
| `newsroom_base_url` | `net.http_post` target | `newsroom_trigger` raises; nothing is sent |

Every targeted function name is checked against the allow-list inside
`newsroom_trigger` (ten scheduled names, nothing else), so a typo in a cron job
cannot make the database call an arbitrary endpoint. A test asserts both the
allow-list and the fail-closed host behaviour.


### Rotate the legacy anon key

Migration `20260503120747_…` (from the project's first iteration) contains a
long-lived anon JWT in plain SQL, and it pointed at a **different** project ref
than the rest of the repo. Treat that key as compromised:

1. Supabase dashboard → Settings → API → **Rotate** the anon key.
2. Update `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` and in the host's build env.
3. The current key is also fine to rotate on the same schedule as any other
   credential.

The old migration is left in place because applied migrations are historical
records; the rescheduled jobs in `20261015120200_…` supersede it.

---

## 3. Scheduled jobs

Phase 6 replaces the old schedule with a closed loop: ingest → write → publish,
plus trend watching, maintenance and a health monitor. See
`supabase/migrations/20261016090100_phase6_autonomy_crons.sql`.

| Job | Schedule (UTC) | Function | Created as | Notes |
| --- | --- | --- | --- | --- |
| `ingest-feeds` | `*/20 * * * *` | `ingest-feeds` | active | feeds → validated, deduplicated candidates |
| `write-desk` | `*/30 * * * *` | `write-desk` | **inactive** | rewrite → verify → score → schedule/review |
| `publish-scheduler` | `*/10 * * * *` | `publish-scheduler` | **inactive** | releases due posts under the caps |
| `trend-watch` | `15 */3 * * *` | `trend-watch` | active | trend scores + content-gap notes |
| `newsroom-maintenance` | `40 * * * *` | `maintenance` | **inactive** | images, links, endpoints, orphans, stale posts |
| `phase6-monitor` | `5,35 * * * *` | `phase6-monitor` | active | health snapshot + alerts (safe to poll) |
| `auto-publish-morning` | `0 6 * * *` | `auto-publish` | **inactive** | edition orchestrator (ingest + write + publish) |
| `auto-publish-midday` | `0 12 * * *` | `auto-publish` | **inactive** | edition orchestrator |
| `auto-publish-evening` | `0 18 * * *` | `auto-publish` | **inactive** | edition orchestrator |
| `breaking-news-monitor` | `*/30 * * * *` | `breaking-news-monitor` | **inactive** | triggers the orchestrator on a new headline |
| `notifications-dispatcher` | `*/10 * * * *` | `notifications-dispatcher` | **inactive** | reader alerts, idempotent per slug/kind/day |
| `validate-feeds-daily` | `30 4 * * *` | `validate-feeds` | active | feed report |
| `prune-post-view-events` | `15 3 * * *` | SQL | active | 90-day retention |
| `prune-automation` | `25 3 * * *` | SQL | active | prunes candidates, runs, alerts, trends |

**8 of 14 jobs inactive (gated) / 6 active (safe)** immediately after the
migration — no publishing-capable job and no maintenance job may run before the
operator preflight below.

The eight gated jobs are created inactive by the migration itself
(`select cron.schedule_in_database(name, schedule, $$ … $$, current_database(),
active := false)`), so a fresh `supabase db push` fails closed: there is no
window in which publishing or archiving starts before preflight, and no manual
pause can be missed. `cron.schedule` on its own cannot create an inactive job —
its three-argument form passes NULL `active`, which pg_cron reads as `true`.

Version note — pg_cron **1.4 or newer is required in both cases**, and the two
cases are otherwise identical. A **fresh install** needs
`cron.schedule_in_database`; an **existing project** whose cron migration was
already applied needs `cron.alter_job` for the gate and the repair migrations.
Both functions arrive in 1.4. Supabase ships 1.6.x on PostgreSQL 13+, but check
before the first push:

```sql
select extversion from pg_extension where extname = 'pg_cron';
```

Below 1.4 there is no SQL workaround in this repository: the cron migration
fails at its first `schedule_in_database`, and `db push` stops there.

Re-applying the migration set stays safe too: the schedule upsert
(`on conflict on constraint jobname_username_uniq do update`) rewrites
`schedule`, `command` and `database` **only** — never `active` — and the gate
`update` runs again. A `db push` or `db reset` on an already-activated project
therefore closes the gate again, and the activation steps must be re-run.

```sql
select jobname, schedule, active from cron.job order by jobname;
select status, status_code, left(content, 200), created
  from net._http_response order by created desc limit 10;
```

### Pause and resume

Everything below is an `UPDATE` on `cron.job`, so pausing is always reversible
and never deletes a job or a post.

```sql
-- The gate: the canonical statement from the migrations, the operator checklist
-- and the test suite. Closes everything that can publish, spend LLM budget,
-- alert readers or archive published content; keeps ingestion, trends, the
-- monitor and both prunes running, so you still see candidates and alerts.
select cron.alter_job(jobid, active => false)
  from cron.job
 where jobname in ('write-desk','publish-scheduler',
                   'auto-publish-morning','auto-publish-midday','auto-publish-evening',
                   'breaking-news-monitor','notifications-dispatcher',
                   'newsroom-maintenance');

-- Pause the entire loop as well (nothing is deleted, no post is lost).
select cron.alter_job(jobid, active => false) from cron.job;

-- Resume everything.
select cron.alter_job(jobid, active => true) from cron.job;
```

After a gate or resume, `select jobname, active from cron.job order by jobname;`
must show 8 of 14 (gate) or 14 of 14 (resume) active.

Why not `update cron.job set active = …`? On Supabase the `postgres` role has
SELECT only on `cron.job` (supabase/postgres migration `20231020085357`,
re-applied whenever pg_cron is created), so a direct UPDATE fails with
"permission denied for table job" — in the SQL editor and inside `db push`
alike. `cron.alter_job(job_id, schedule, command, database, username, active)`
is the supported API from pg_cron 1.4: it runs as the extension owner, changes
only the arguments supplied (schedules and commands are preserved), and
invalidates the job cache the same way the UPDATE did. Run it as `postgres`,
the role that created the jobs; another role gets "Job N does not exist or you
don't own it".

`cron.unschedule('jobname')` is the permanent version and is what the migration
uses before it re-creates a job.

### First activation (the Phase 6.1 gate)

The migration creates publishing, alerting and maintenance jobs **inactive**,
so `supabase db push` on a fresh project fails closed: nothing that can publish,
spend LLM budget, alert readers or archive content can run before you have been
through this list. Do it in order.

```bash
# 0. Create BOTH Vault rows first (see section 2). The base URL is required:
#    without it every cron job fails closed and nothing ingests.
#      select vault.create_secret('https://xuqxautmflofkvbsaanh.supabase.co',
#                                 'newsroom_base_url', 'NewsSparkle automation host');

# 1. Apply the migrations, then confirm the gate is closed (it already is).
supabase link --project-ref xuqxautmflofkvbsaanh
supabase db push            # 14 migrations
#    SQL editor — the canonical gate statement. It is a no-op on a fresh
#    install, and it is what closes the gate on a project migrated before the
#    fail-closed change. cron.alter_job, not UPDATE: `postgres` has SELECT only
#    on cron.job, so an UPDATE fails with "permission denied for table job".
#      select cron.alter_job(jobid, active => false)
#        from cron.job
#       where jobname in ('write-desk','publish-scheduler',
#                         'auto-publish-morning','auto-publish-midday','auto-publish-evening',
#                         'breaking-news-monitor','notifications-dispatcher',
#                         'newsroom-maintenance');
#    Verify: select jobname, active from cron.job order by jobname;
#      -> 8 of 14 jobs inactive (gated) / 6 active (safe), i.e. those 8 rows
#         false and ingest-feeds / trend-watch / phase6-monitor /
#         validate-feeds-daily / prune-post-view-events / prune-automation true.
#    If the count is not 8/6, stop: migrations 20261016090200 and
#    20261017090000 close the gate again on any project that already has the
#    jobs (re-runnable, change nothing else). They never create a job, so they
#    are not a fix for a fresh install that failed on pg_cron < 1.4.

# 2. Secrets — the same value in Vault and in the function environment.
openssl rand -hex 32
#    SQL: select vault.create_secret('<value>', 'auto_publish_secret', 'NewsSparkle automation');
supabase secrets set AUTO_PUBLISH_SECRET=<same value>
supabase secrets set SITE_URL=https://newssparkle.lovable.app
supabase secrets set LOVABLE_API_KEY=<AI key>

# 3. Deploy and confirm the gateway.
npm run check:functions && supabase functions deploy
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "https://<project-ref>.supabase.co/functions/v1/ingest-feeds" -d '{}'   # expect 401

# 4. Manual dry run, one stage at a time (jobs still paused).
curl -sS -X POST ".../functions/v1/ingest-feeds" -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" \
  -d '{"maxSources":3}' | jq '{ok, checked: .metrics.sources_checked, rejected: .metrics.rejected}'
curl -sS -X POST ".../functions/v1/write-desk" -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" \
  -d '{"limit":1}' | jq '{ok, written: .itemsOut, llm: .llmCalls, errors}'
#    Expect a post with status=review or scheduled — never published yet.
select slug, status, scheduled_for, quality_score from public.posts order by created_at desc limit 5;

# 5. Release exactly one story by hand and read it in the browser.
#    IMPORTANT: the desk schedules a story one minimum gap (25 min) or more into
#    the future - measured at 55 minutes for the midday edition - so calling the
#    scheduler straight away correctly publishes NOTHING (metrics.due = 0).
#    Either wait for the slot, or pull that one story forward first:
#      update public.posts set scheduled_for = now() - interval '1 minute'
#       where slug = '<slug-from-step-4>';
curl -sS -X POST ".../functions/v1/publish-scheduler" -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" \
  -d '{"limit":1}' | jq '{ok, published: .metrics.published, today: .metrics.published_today}'
#    Expect published: 1 and metrics.slugs: ["<slug>"]. It stays at 1: a second
#    call returns published: 0.

# 6. Only now, re-enable the loop - in two documented steps.
#    G1 (publishing):  select cron.alter_job(jobid, active => true) from cron.job
#                       where jobname in ('write-desk','publish-scheduler');
#    G2 (after 24h):   select cron.alter_job(jobid, active => true) from cron.job
#                       where jobname in ('auto-publish-morning','auto-publish-midday',
#                                         'auto-publish-evening','breaking-news-monitor',
#                                         'notifications-dispatcher');
#    (cron.alter_job(jobid, active := true) is the equivalent API form, for the
#     role that owns the job - parameter names are part of the signature, so
#     `active :=` only works with pg_cron 1.4+.)
#    G3 (maintenance) is a SEPARATE decision, not part of the publishing
#    ramp-up: run the query in the paragraph below first, then
#      select cron.alter_job(jobid, active => true) from cron.job
#       where jobname in ('newsroom-maintenance');
#    Leaving it inactive is a supported state - ingestion, writing, publishing,
#    trends, the monitor and both prunes are unaffected.

# 7. Watch for 24 hours.
curl -sS -X POST ".../functions/v1/phase6-monitor" -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" \
  | jq '{ok, autonomy, problems: .metrics.problems, hours_since_publish: .metrics.hours_since_publish}'
```

`newsroom-maintenance` is the one job that changes *published* stories, so it
ships gated and its activation is step G3, ordered **after** this pre-check: it
archives posts older than 730 days with fewer than 50 views (status `archived`
disappears from the site, sitemaps and feeds) and replaces broken featured
images. Look at the rows it would touch, then decide:

```sql
select slug, published_at, views from public.posts
 where status = 'published' and published_at < now() - interval '730 days' and coalesce(views,0) < 50;
```

0 rows on a young site means there is nothing to archive. Rows you consider
evergreen mean either raising `MAINTENANCE_RULES.archiveAfterDays`
(`supabase/functions/_shared/maintenance.ts`, then redeploy `maintenance`) or
leaving `newsroom-maintenance` inactive for good. An archive is reversible:
`update public.posts set status = 'published', archived_at = null where slug = '<slug>';`

Stop conditions: if `phase6-monitor` returns `ok:false` *for a change you made*,
if the desk writes nothing for 12 hours, or if any post reads wrong — close the
gate with the step 1 statement, fix forward, and re-run steps 4–5. A fresh project
reports `ok:false` with "candidate queue empty and nothing scheduled" until the
first candidates arrive; that is expected, not a failure.

The audited, step-by-step version of this procedure (with expected outputs and
rollback for each step) is `phase6_activation_checklist.txt` in the repo root.

### Health check

`phase6-monitor` is the endpoint to watch; a `200` with `ok: true` means the
newsroom is publishing unattended.

```bash
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/phase6-monitor" \
  -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" | jq '{ok, autonomy, problems: .metrics.problems}'
```

Useful SQL while triaging:

```sql
-- Are candidates arriving, and are they being consumed?
select status, count(*) from public.ingested_items group by status order by 2 desc;

-- What did the desk do in the last 24 hours?
select function, count(*) filter (where ok) as ok_runs, sum(llm_calls) as llm_calls,
       max(started_at) as last_run, max(error) filter (where not ok) as last_error
  from public.pipeline_runs
 where started_at > now() - interval '24 hours'
 group by function order by function;

-- Open alerts, newest first.
select severity, code, subject, message, occurrences, updated_at
  from public.agent_alerts where resolved_at is null order by updated_at desc;

-- Did the maintenance sweep fix anything?
select kind, ok, checked, counts, created_at
  from public.content_health_checks order by created_at desc limit 5;
```

Trigger a slot by hand (orchestrator: ingest + write + publish):

```bash
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/auto-publish" \
  -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"slot":"midday","categories":["technology"]}' | jq
```

Run a single stage (useful when debugging one part of the loop):

```bash
# fetch feeds only
curl -sS -X POST ".../functions/v1/ingest-feeds" -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" | jq '.itemsIn, .itemsOut'
# write one story from the queue
curl -sS -X POST ".../functions/v1/write-desk" -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" -d '{"limit":1}' | jq
# release whatever is due
curl -sS -X POST ".../functions/v1/publish-scheduler" -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" | jq
# housekeeping without network calls
curl -sS -X POST ".../functions/v1/maintenance" -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" -d '{"offline":true}' | jq
```

---

## 4. Verifying security after a deploy

```sql
-- 1. anon/authenticated must hold SELECT only on editorial tables
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.table_privileges
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated')
 group by 1, 2
 order by 1;

-- 2. the write loophole must be gone
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'posts';
-- expect SELECT policies only

-- 3. view counting still works (returns without error)
select public.increment_post_views(
  (select slug from public.posts where status = 'published' limit 1), 'test-visitor-id');
```

Then from outside the database:

```bash
# Unauthenticated call must be rejected
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST "https://<project-ref>.supabase.co/functions/v1/auto-publish" -d '{}'
# expect 401

# Public feeds must stay open
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://<project-ref>.supabase.co/functions/v1/sitemap"
# expect 200
```

---

## 5. Feed health

`validate-feeds` checks the XML declaration, namespaces, `<loc>` absoluteness,
tag balance and unescaped ampersands, then stores the report in
`feed_validation_runs`:

```bash
curl -sS "https://<project-ref>.supabase.co/functions/v1/validate-feeds" \
  -H "Authorization: Bearer $AUTO_PUBLISH_SECRET" | jq '{ok, errors, warnings}'
```

Run it after any change to the sitemap/RSS functions or to `SITE_URL`.

---

## 6. Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| Article URLs render blank | A render error with no boundary | Boundaries are in place; check the console and fix the component |
| Avatars show a broken image | A `.png` under `/authors/` has no `.webp` twin | `npm run assets` |
| Sitemap shows dead URLs | `public/sitemap.xml` was hand-edited | `npm run seo` |
| Auto-publish returns 401 | Secret missing in Vault or function env | See §2 |
| Auto-publish returns 500 `AI credits exhausted` | Gateway credit exhausted | Top up, or pause the cron jobs |
| Duplicate stories | Model rewrote an existing headline | The function rejects > 80 % overlap; re-run |
| Views not increasing | `post_view_events` already has this visitor today | Expected — one view per reader per day |
