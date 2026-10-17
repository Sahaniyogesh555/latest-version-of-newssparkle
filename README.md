# NewsSparkle

An independent digital news publication: a React + Vite front end, a Supabase
back end, and an automated newsroom that sources, writes and schedules its own
stories.

```
React 18 · Vite 5 · TypeScript · Tailwind + shadcn/ui
Supabase (Postgres + RLS + pg_cron + Realtime + Edge Functions on Deno)
Automated publishing: RSS / Google Trends / GNews / NewsAPI / SerpAPI → LLM → published article
```

---

## Quick start

```bash
npm ci
cp .env.example .env      # fill in the Supabase URL + publishable key
npm run dev               # http://localhost:8080
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (regenerates `public/sitemap.xml` + `robots.txt` first) |
| `npm run dev:demo` | Same, but backed by local sample fixtures instead of the database |
| `npm run build` | Typecheck **then** production build |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint (0 errors expected) |
| `npm run check:functions` | `deno check` on every edge function entrypoint (skips if deno is absent) |
| `npm test` | Vitest suite |
| `npm run verify` | Typecheck + lint + test + build — run this before pushing |
| `npm run seo` | Regenerate `public/sitemap.xml` and `public/robots.txt` from `.env` |
| `npm run assets` | Rebuild brand icons, the social card and author WebP twins (needs ImageMagick) |

The migration suite (`src/test/phase6-sql.test.ts`) replays every SQL file in
`supabase/migrations` against PostgreSQL 18 (PGlite) and asserts the schema,
RLS, RPC and cron contracts — so a broken migration fails in CI, not in
production.

CI runs typecheck, lint, tests and a build on every pull request, and fails if
`dist/` exceeds 4 MiB. The workflow definition is kept at
`docs/ci-workflow.pending.yml` and needs to be copied to
`.github/workflows/ci.yml` by a token that holds the `workflows` permission.

### Demo mode

`npm run dev:demo` starts the app with `VITE_DEMO_MODE=true`, which swaps the
Supabase client for a fixture-backed stand-in (`src/lib/demo/`). Useful for UI
work, previews and screenshots when the database is unreachable. A red banner is
rendered across the top of every page while it is active, and the flag is off by
default — production builds never include the fixtures.

---

## Repository layout

```
src/
  pages/            route components (19 routes, lazy-loaded per route)
  components/        article/page components + vendored shadcn `ui/`
  lib/
    site.ts         brand constants, CATEGORIES (single source of truth)
    posts.ts        column lists + runtime normalisers for DB rows
    authors.ts      the six editorial desks (avatars, bios, beats)
    bookmarks.ts    localStorage bookmarks store
    visitor.ts      anonymous id used to de-duplicate view counts
  integrations/supabase/  generated client + Database types
  lib/demo/       fixture-backed client used only when VITE_DEMO_MODE=true
supabase/
  migrations/       schema, RLS policies, grants, cron schedules
  functions/
    _shared/        auth, http, site + the Phase 6 newsroom modules
                    (text, dedupe, classify, safety, facts, quality, seo,
                     schedule, retry, sources, images, trends, maintenance,
                     ai, db, pipeline) — pure logic, unit tested in src/test
    auto-publish/           edition orchestrator: ingest → write → publish
    ingest-feeds/           feeds → validated, deduplicated candidates
    write-desk/             rewrite → verify → score → schedule or hold
    publish-scheduler/      releases due posts under the publishing caps
    trend-watch/            trend scores + content-gap notes
    maintenance/            images, links, endpoints, orphans, stale posts
    phase6-monitor/         newsroom health snapshot + alerts (safe to poll)
    breaking-news-monitor/  watches top feeds, triggers auto-publish
    notifications-dispatcher/  emits breaking/trending alerts
    sitemap/ news-sitemap/ rss/  public crawler + reader endpoints
    validate-feeds/         format-checks the feeds and logs a report
scripts/
  build-assets.sh         brand icons, og card, author WebP
  sync-seo-endpoints.mjs  generates public/sitemap.xml + robots.txt
docs/
  OPERATIONS.md   deploy, secrets, cron, runbook
  PHASES.md       build history and what remains
```

---

## How publishing works

1. **pg_cron** (in the database) fires `public.trigger_auto_publish(slot)` at
   06:00, 12:00 and 18:00 UTC. The function reads the automation secret from
   Supabase Vault and calls the `auto-publish` edge function with all six
   categories → **up to 18 posts/day**.
2. **`auto-publish`** gathers source headlines (RSS → Google Trends → GNews →
   NewsAPI → SerpAPI), passes them plus the list of already-published headlines
   to the LLM, and asks for a structured article (title, meta, body, takeaways,
   FAQ). It rejects output that duplicates an existing headline, strips
   hallucinated internal links, resolves a featured image, and inserts the post
   with the matching desk byline.
3. **`breaking-news-monitor`** runs every 30 minutes and triggers a
   breaking-news write when a genuinely new top story appears.
4. **`notifications-dispatcher`** runs every 10 minutes and emits
   breaking/trending alerts for the reader-facing notification widget.
5. **Feeds** (`sitemap`, `news-sitemap`, `rss`) are rebuilt from the database on
   request and are the only public endpoints.

Every write-capable function requires a shared secret
(`AUTO_PUBLISH_SECRET` / `CRON_SECRET` or the service-role key) — see
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

---

## Data model

| Table | Purpose | Public access |
| --- | --- | --- |
| `posts` | Articles. `status = 'published'` is the only publicly readable state. | SELECT (published rows) |
| `categories` | Sections. | SELECT |
| `notifications` | Breaking/trending alerts (Realtime, 24h expiry). | SELECT (unexpired) |
| `feed_validation_runs` | Feed validator reports. | SELECT |
| `post_view_events` | One row per reader per article per day, used to de-duplicate views. | **None** (RLS on, no policies) |

Anonymous roles are read-only: `REVOKE ALL ... FROM anon, authenticated` plus an
explicit `GRANT SELECT`. The view counter is the only legitimate write and goes
through `public.increment_post_views(slug, visitor_id)` (`SECURITY DEFINER`).

---

## SEO

* Per-route canonical, OG, Twitter and JSON-LD tags via the `SEO` component
  (canonical origin comes from `VITE_SITE_URL`, never `window.location`).
* `sitemap.xml`, `news-sitemap`, `rss` are served by edge functions;
  `public/sitemap.xml` is a sitemap **index** pointing at their real
  `*.supabase.co` URLs (generated by `npm run seo`).
* `angular`-free, mobile-first layout, article structured data, breadcrumbs and
  FAQ schema. There is deliberately no `aggregateRating` — ratings are not
  fabricated from pageviews.

### Known SEO limitation

The site is a client-rendered SPA. Googlebot renders JavaScript, but
social/chat unfurlers do not, so link previews use the site-wide
`og-default.jpg` rather than a per-article image. Pre-rendering article routes
at publish time is the recommended next step — see `docs/PHASES.md`.

---

## Environment

Client (`.env`, public — never put secrets here):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
VITE_SITE_URL=https://newssparkle.lovable.app   # canonical origin
```

Server (`supabase secrets set ...`): `AUTO_PUBLISH_SECRET`, `LOVABLE_API_KEY`,
`SITE_URL`, and optionally `GNEWS_API_KEY`, `NEWSAPI_KEY`, `SERPAPI_KEY`,
`UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`. Full list with explanation in
[`.env.example`](.env.example).

---

## Contributing

1. Branch from `main`.
2. `npm run verify` must pass.
3. Add a test for behavioural changes — `src/test/repo-integrity.test.ts` covers
   asset paths, edge-function auth, migration hygiene and build config, so it is
   usually the fastest place to add a guard for "this must never happen again".
