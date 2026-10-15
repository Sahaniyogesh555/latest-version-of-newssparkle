// @vitest-environment node
/**
 * Phase 6.1 — migration verification against a real PostgreSQL.
 *
 * The migrations are executed by PostgreSQL 18 (compiled to WASM by PGlite)
 * inside this test, in filename order, on a database seeded by the same
 * Supabase building blocks the project runs on (stubbed: pg_cron, pg_net,
 * Vault, auth, the anon/authenticated/service_role roles).
 *
 * What this proves: the SQL parses and executes, the constraints/indexes/RLS
 * really exist afterwards, the RPCs behave as the pipeline expects, the cron
 * migration schedules the intended jobs without duplicates, and the Vault-based
 * trigger sends what it should. What it cannot prove: anything that depends on
 * the Supabase platform itself (real Vault encryption, real HTTP delivery, the
 * deployed function binaries) — those stay BLOCKED and are listed in the
 * Phase 6.1 report.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MIGRATIONS_DIR,
  createStagingDb,
  migrationFiles,
  prepareMigrationSql,
  readMigration,
  rows,
  scalar,
  type StagingDb,
} from "./harness/sql-staging.ts";
import {
  ACTIVATION_STEPS,
  ALL_JOBS,
  GATED_JOB_NAMES,
  GATE_SQL,
  SAFE_JOB_NAMES,
  extractActiveStatements,
  jobNamesInStatement,
  normaliseSql,
} from "./harness/cron-contract.ts";

const PHASE6_SCHEMA = "20261016090000_phase6_autonomy_schema.sql";
const PHASE6_CRONS = "20261016090100_phase6_autonomy_crons.sql";
const PHASE6_GATE = "20261016090200_phase6_activation_gate.sql";
const CHECKLIST = join(process.cwd(), "phase6_activation_checklist.txt");

/** The post statuses the app and the pipeline use (posts_status_check). */
const VALID_STATUSES = ["draft", "review", "scheduled", "published", "rejected", "archived"];



let staging: StagingDb;

beforeAll(async () => {
  staging = await createStagingDb();
}, 180_000);

afterAll(async () => {
  await staging?.close();
});

describe("migration chain", () => {
  it("applies every migration in filename order with only the documented substitutions", () => {
    const failures = staging.runs.filter((run) => !run.ok);
    expect(failures.map((run) => `${run.file}: ${run.error}`)).toEqual([]);
    expect(staging.runs).toHaveLength(migrationFiles().length);

    // The only statements that had to change are the three `create extension`
    // lines for extensions PGlite does not ship (pg_cron, pg_net, pgcrypto).
    expect(staging.allSubstituted).toHaveLength(3);
    expect(staging.allSubstituted.join(" ")).toContain("pg_cron");
    expect(staging.allSubstituted.join(" ")).toContain("pg_net");
    expect(staging.allSubstituted.join(" ")).toContain("pgcrypto");
  });

  it("keeps the Phase 6 migrations idempotent when re-applied", async () => {
    // Supabase records applied migrations, so this is belt-and-braces: a
    // re-run (or a partially applied migration) must not fail or duplicate data.
    for (const file of [PHASE6_SCHEMA, PHASE6_CRONS]) {
      const { sql } = prepareMigrationSql(readMigration(file));
      await expect(staging.db.exec(sql)).resolves.not.toThrow();
    }

    const sources = await scalar<number>(staging.db, "select count(*)::int from public.content_sources");
    expect(sources).toBe(24); // seeded once, `on conflict do nothing` kept it at 24
    const jobs = await scalar<number>(staging.db, "select count(*)::int from cron.job");
    expect(jobs).toBe(ALL_JOBS.length);
  });
});

describe("schema objects", () => {
  it("creates the automation tables and the new posts columns", async () => {
    const tables = await rows<{ table_name: string }>(
      staging.db,
      `select table_name from information_schema.tables
        where table_schema = 'public'
          and table_name in ('content_sources','ingested_items','topic_trends',
                             'pipeline_runs','agent_alerts','content_health_checks')
        order by table_name`,
    );
    expect(tables.map((t) => t.table_name)).toEqual([
      "agent_alerts",
      "content_health_checks",
      "content_sources",
      "ingested_items",
      "pipeline_runs",
      "topic_trends",
    ]);

    const expectedColumns = [
      "quality_score",
      "quality_report",
      "dedupe_fingerprint",
      "simhash",
      "word_count",
      "review_reason",
      "scheduled_for",
      "published_by",
      "ai_model",
      "source_refs",
      "image_credit",
      "image_credit_url",
      "source_category",
      "attempts",
      "last_error",
      "next_attempt_at",
      "archived_at",
    ];
    const columns = await rows<{ column_name: string }>(
      staging.db,
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'posts'`,
    );
    const names = columns.map((c) => c.column_name);
    for (const column of expectedColumns) {
      expect(names, `posts.${column} must exist`).toContain(column);
    }
    expect(expectedColumns).toHaveLength(17);

    const indexes = await rows<{ indexname: string }>(
      staging.db,
      `select indexname from pg_indexes
        where schemaname = 'public'
          and indexname in ('idx_posts_schedule','idx_posts_review','idx_posts_published_category_day','idx_posts_dedupe',
                            'idx_content_sources_active','idx_ingested_items_queue','idx_ingested_items_category',
                            'idx_ingested_items_expiry','idx_topic_trends_live','idx_pipeline_runs_recent',
                            'idx_pipeline_runs_function','idx_agent_alerts_open','idx_content_health_recent')`,
    );
    expect(indexes).toHaveLength(13);
  });

  it("enforces the editorial status lifecycle and the uniqueness rules", async () => {
    for (const status of VALID_STATUSES) {
      await expect(
        staging.db.exec(
          `insert into public.posts (title, slug, excerpt, content, meta_title, meta_description, category_slug, status)
           values ('t','slug-${status}','e','c','m','md','world','${status}')`,
        ),
      ).resolves.not.toThrow();
    }
    await expect(
      staging.db.exec(
        `insert into public.posts (title, slug, excerpt, content, meta_title, meta_description, category_slug, status)
         values ('t','slug-invalid','e','c','m','md','world','half-baked')`,
      ),
    ).rejects.toThrow(/posts_status_check/);

    // Ingested items are unique per fingerprint (the same story from two wires
    // must collapse into one row rather than create a second candidate).
    await staging.db.exec(
      `insert into public.ingested_items (fingerprint, title, source_name) values ('fp-1','Story','BBC')`,
    );
    const duplicate = await staging.db
      .query(`insert into public.ingested_items (fingerprint, title, source_name) values ('fp-1','Story','CNN')
              on conflict (fingerprint) do nothing returning id`)
      .then((result) => result.rows.length)
      .catch(() => -1);
    expect(duplicate).toBe(0);

    // One alert per (code, subject, day): the second call bumps the counter.
    await staging.db.exec(`select public.record_alert('queue-empty','first','warning','monitor')`);
    await staging.db.exec(`select public.record_alert('queue-empty','second','warning','monitor')`);
    const alert = await rows<{ message: string; occurrences: number }>(
      staging.db,
      `select message, occurrences from public.agent_alerts where code = 'queue-empty'`,
    );
    expect(alert).toHaveLength(1);
    expect(alert[0].message).toBe("second");
    expect(alert[0].occurrences).toBe(2);
  });

  it("keeps every automation table private (RLS on, anon/authenticated revoked)", async () => {
    for (const table of [
      "content_sources",
      "ingested_items",
      "topic_trends",
      "pipeline_runs",
      "agent_alerts",
      "content_health_checks",
    ]) {
      const rls = await scalar<boolean>(
        staging.db,
        `select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = $1`,
        [table],
      );
      expect(rls, `${table} must have RLS enabled`).toBe(true);

      for (const role of ["anon", "authenticated"]) {
        const canSelect = await scalar<boolean>(
          staging.db,
          `select has_table_privilege($1, $2, 'SELECT')`,
          [role, `public.${table}`],
        );
        const canInsert = await scalar<boolean>(
          staging.db,
          `select has_table_privilege($1, $2, 'INSERT')`,
          [role, `public.${table}`],
        );
        expect(canSelect, `${role} must not read ${table}`).toBe(false);
        expect(canInsert, `${role} must not write ${table}`).toBe(false);
      }
    }
  });

  it("keeps the public read policy on posts intact", async () => {
    // Phase 6 changes the status lifecycle; readers must still only see published.
    const policy = await rows<{ qual: string | null }>(
      staging.db,
      `select qual from pg_policies where schemaname = 'public' and tablename = 'posts' and cmd = 'SELECT'`,
    );
    expect(policy.length).toBeGreaterThan(0);
    expect(policy.some((p) => (p.qual ?? "").includes("published"))).toBe(true);

    const anonInsert = await scalar<boolean>(
      staging.db,
      `select has_table_privilege('anon', 'public.posts', 'INSERT')`,
    );
    expect(anonInsert).toBe(false);
  });

  it("locks down the RPCs: security definer with a fixed search_path, not executable by anon", async () => {
    const functions = [
      "public.newsroom_trigger(text,jsonb,integer)",
      "public.claim_ingested_items(integer)",
      "public.category_published_count(text,timestamptz)",
      "public.newsroom_llm_calls_today()",
      "public.newsroom_status()",
      "public.prune_automation_tables()",
      "public.record_alert(text,text,text,text,jsonb)",
    ];

    for (const signature of functions) {
      const meta = await rows<{ prosecdef: boolean; proconfig: string[] | null }>(
        staging.db,
        `select prosecdef, proconfig from pg_proc where oid = $1::regprocedure`,
        [signature],
      );
      expect(meta, `${signature} must exist`).toHaveLength(1);
      expect(meta[0].prosecdef, `${signature} must be security definer`).toBe(true);
      expect(
        (meta[0].proconfig ?? []).some((setting) => setting.startsWith("search_path=")),
        `${signature} must pin search_path`,
      ).toBe(true);

      for (const role of ["anon", "authenticated"]) {
        const canExecute = await scalar<boolean>(
          staging.db,
          `select has_function_privilege($1, $2, 'EXECUTE')`,
          [role, signature],
        );
        expect(canExecute, `${role} must not execute ${signature}`).toBe(false);
      }
    }
  });
});

describe("candidate queue RPC", () => {
  it("claims the highest-priority candidate exactly once", async () => {
    await staging.db.exec(`
      insert into public.ingested_items (fingerprint, title, source_name, trust_tier, trend_score, corroboration)
      values
        ('fp-strong',  'Trending story',        'Reuters', 1, 80, 3),
        ('fp-average', 'Ordinary story',        'Blog',    3, 0,  1),
        ('fp-expired', 'Expired story',         'Blog',    3, 0,  1),
        ('fp-later',   'Retry later',           'Blog',    3, 0,  1);
      update public.ingested_items set expires_at = now() - interval '1 hour' where fingerprint = 'fp-expired';
      update public.ingested_items set next_attempt_at = now() + interval '1 hour' where fingerprint = 'fp-later';
    `);

    const first = await rows<{ fingerprint: string; status: string; attempts: number }>(
      staging.db,
      `select fingerprint, status, attempts from public.claim_ingested_items(2)`,
    );
    const claimed = first.map((row) => row.fingerprint);
    // Tier 1 (Reuters) outranks everything; tier 2 outranks tier 3.
    expect(claimed).toContain("fp-strong");
    expect(claimed).toContain("fp-1"); // tier 2 from the uniqueness test above
    // Expired candidates and ones inside a retry backoff are never handed out.
    expect(claimed).not.toContain("fp-expired");
    expect(claimed).not.toContain("fp-later");
    expect(first.every((row) => row.status === "processing")).toBe(true);
    expect(first.every((row) => row.attempts === 1)).toBe(true);

    // Repeated execution (overlapping cron runs, e.g. 20-minute ingest ticks
    // colliding with a 30-minute write-desk tick) must never re-claim a row.
    const second = await rows<{ fingerprint: string }>(
      staging.db,
      `select fingerprint from public.claim_ingested_items(5)`,
    );
    const reclaimed = second.map((row) => row.fingerprint);
    expect(reclaimed).not.toContain("fp-strong");
    expect(reclaimed).not.toContain("fp-1");
    expect(reclaimed).toEqual(["fp-average"]); // the only untouched candidate

    const attempts = await rows<{ attempts: number }>(
      staging.db,
      `select attempts from public.ingested_items where fingerprint in ('fp-strong','fp-1','fp-average')`,
    );
    expect(attempts.map((row) => row.attempts)).toEqual([1, 1, 1]);
  });

  it("counts published and scheduled posts per category and reports status", async () => {
    await staging.db.exec(`
      insert into public.posts (title, slug, excerpt, content, meta_title, meta_description, category_slug, status, published_at)
      values ('Published today','pub-today','e','c','m','md','business','published', now()),
             ('Scheduled today','sched-today','e','c','m','md','business','scheduled', now())
      on conflict (slug) do nothing;
      insert into public.pipeline_runs (function, ok, items_in, items_out, llm_calls)
      values ('write-desk', true, 2, 1, 3), ('ingest-feeds', true, 10, 4, 0);
    `);

    const perCategory = await scalar<number>(
      staging.db,
      `select public.category_published_count('business', date_trunc('day', now() at time zone 'utc'))`,
    );
    expect(perCategory).toBe(2);

    const llmCalls = await scalar<number>(staging.db, `select public.newsroom_llm_calls_today()`);
    expect(llmCalls).toBe(3);

    const status = await scalar<Record<string, Record<string, unknown>>>(
      staging.db,
      `select public.newsroom_status()`,
    );
    expect(Object.keys(status).sort()).toEqual([
      "alerts",
      "candidates",
      "generated_at",
      "llm",
      "pipeline",
      "posts",
      "sources",
      "trends",
    ]);
    expect(Number(status.posts.published_total)).toBeGreaterThan(0);
    expect(status.llm.calls_today).toBe(3);
    expect(status.candidates.processing).toBe(3);
  });

  it("prunes only what is past retention", async () => {
    await staging.db.exec(`
      update public.ingested_items set expires_at = now() - interval '10 days' where fingerprint = 'fp-expired';
      insert into public.pipeline_runs (function, ok, started_at) values ('old-run', true, now() - interval '40 days');
      insert into public.content_health_checks (kind, ok, created_at) values ('old-check', true, now() - interval '40 days');
      insert into public.topic_trends (topic, topic_key, expires_at) values ('old trend','old trend', now() - interval '10 days');
      insert into public.agent_alerts (code, subject, message, resolved_at)
      values ('resolved-old','x','y', now() - interval '90 days');
    `);

    await staging.db.exec(`select public.prune_automation_tables()`);

    expect(await scalar<number>(staging.db, `select count(*)::int from public.ingested_items where fingerprint = 'fp-expired'`)).toBe(0);
    expect(await scalar<number>(staging.db, `select count(*)::int from public.pipeline_runs where function = 'old-run'`)).toBe(0);
    expect(await scalar<number>(staging.db, `select count(*)::int from public.content_health_checks where kind = 'old-check'`)).toBe(0);
    expect(await scalar<number>(staging.db, `select count(*)::int from public.topic_trends where topic_key = 'old trend'`)).toBe(0);
    expect(await scalar<number>(staging.db, `select count(*)::int from public.agent_alerts where code = 'resolved-old'`)).toBe(0);

    // Fresh rows survive.
    expect(await scalar<number>(staging.db, `select count(*)::int from public.ingested_items where status = 'processing'`)).toBe(3);
  });
});

describe("cron schedule and the Vault trigger", () => {
  it("schedules exactly the intended jobs, once each, with the intended schedules", async () => {
    const jobs = await rows<{ jobname: string; schedule: string; command: string; active: boolean }>(
      staging.db,
      `select jobname, schedule, command, active from cron.job order by jobname`,
    );

    expect(jobs).toHaveLength(ALL_JOBS.length);
    for (const expected of ALL_JOBS) {
      const job = jobs.find((entry) => entry.jobname === expected.name);
      expect(job, `${expected.name} must be scheduled`).toBeDefined();
      expect(job?.schedule).toBe(expected.schedule);
      // Whitespace-insensitive: the migration wraps the SQL over two lines.
      expect(job?.command.replace(/\s+/g, " ").trim()).toBe(expected.command);
    }

    // Names are asserted exactly, so a renamed or added job fails loudly.
    expect(jobs.map((job) => job.jobname).sort()).toEqual([...ALL_JOBS.map((job) => job.name)].sort());
  });

  it("creates the gate set inactive and the safe jobs active on a fresh install", async () => {
    // The fail-closed guarantee: a fresh `db push` must not leave any job that
    // can publish, queue with LLM budget, alert readers or archive published
    // content in an executing state.
    const gated = await rows<{ jobname: string; active: boolean }>(
      staging.db,
      `select jobname, active from cron.job where jobname = any($1) order by jobname`,
      [GATED_JOB_NAMES],
    );
    expect(gated.map((row) => row.jobname).sort()).toEqual([...GATED_JOB_NAMES].sort());
    expect(gated.map((row) => row.jobname)).toHaveLength(GATED_JOB_NAMES.length);
    expect(gated.every((row) => row.active === false), "every gate job must be inactive").toBe(true);

    const safe = await rows<{ jobname: string; active: boolean }>(
      staging.db,
      `select jobname, active from cron.job where jobname = any($1) order by jobname`,
      [SAFE_JOB_NAMES],
    );
    expect(safe.map((row) => row.jobname).sort()).toEqual([...SAFE_JOB_NAMES].sort());
    expect(safe).toHaveLength(SAFE_JOB_NAMES.length);
    expect(safe.every((row) => row.active === true), "ingestion and monitoring must stay on").toBe(true);

    // Counts, so "8 inactive / 6 active" in the docs is a checked fact.
    expect(GATED_JOB_NAMES).toHaveLength(8);
    expect(SAFE_JOB_NAMES).toHaveLength(6);
    expect(GATED_JOB_NAMES.length + SAFE_JOB_NAMES.length).toBe(ALL_JOBS.length);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where not active`)).toBe(8);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where active`)).toBe(6);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job`)).toBe(14);
  });

  it("keeps the gate closed when the migrations are re-applied", async () => {
    // supabase db reset / a manual re-apply must not open the gate. The
    // migration unschedules and recreates the jobs, so the gate set is rebuilt
    // inactive and the safe jobs are rebuilt active.
    for (const file of [PHASE6_SCHEMA, PHASE6_CRONS, PHASE6_GATE]) {
      const { sql } = prepareMigrationSql(readMigration(file));
      await expect(staging.db.exec(sql)).resolves.not.toThrow();
    }

    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job`)).toBe(14);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where not active`)).toBe(8);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where active`)).toBe(6);

    const schedulePreserved = await rows<{ jobname: string; schedule: string; command: string }>(
      staging.db,
      `select jobname, schedule, command from cron.job where jobname = any($1)`,
      [ALL_JOBS.map((job) => job.name)],
    );
    for (const expected of ALL_JOBS) {
      const job = schedulePreserved.find((entry) => entry.jobname === expected.name);
      expect(job?.schedule, `${expected.name} schedule must survive a re-apply`).toBe(expected.schedule);
      expect(job?.command.replace(/\s+/g, " ").trim()).toBe(expected.command);
    }
  });

  it("keeps the gate closed if the operator activates jobs and the files are re-applied", async () => {
    // Fail-closed means: re-applying the migration set resets the gate even if
    // somebody had enabled jobs. The checklist documents that a re-apply
    // requires re-running the activation steps.
    await staging.db.exec(ACTIVATION_STEPS[0].sql);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where active`)).toBe(8);

    for (const file of [PHASE6_CRONS, PHASE6_GATE]) {
      const { sql } = prepareMigrationSql(readMigration(file));
      await staging.db.exec(sql);
    }
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where active`)).toBe(6);
  });

  it("opens only through the documented activation steps, and only the documented jobs", async () => {
    // The SQL here is read from phase6_activation_checklist.txt, not typed into
    // this test: the operator's commands are the ones under test.
    const checklist = readFileSync(CHECKLIST, "utf8");
    const documented = extractActiveStatements(checklist, "true")
      .filter((statement) => jobNamesInStatement(statement).length > 0);

    const expected = ACTIVATION_STEPS.map((step) => normaliseSql(step.sql));
    expect(documented).toEqual(expected);

    for (const step of ACTIVATION_STEPS) {
      await staging.db.exec(step.sql);

      const active = await rows<{ jobname: string }>(
        staging.db,
        `select jobname from cron.job where active and jobname is not null order by jobname`,
      );
      const enabled = active
        .map((row) => row.jobname)
        .filter((name) => GATED_JOB_NAMES.includes(name))
        .sort();
      expect(enabled, `after ${step.id} exactly the approved gate jobs are live`).toEqual(
        [...step.activeAfter].sort(),
      );
      expect(step.enables.length).toBeGreaterThan(0);
      // The safe jobs must never be touched by an activation step.
      for (const name of SAFE_JOB_NAMES) {
        expect(await scalar<boolean>(staging.db, `select active from cron.job where jobname = $1`, [name])).toBe(true);
      }
    }

    // Nothing outside the gate set can ever be enabled by a documented step.
    for (const step of ACTIVATION_STEPS) {
      for (const name of step.enables) {
        expect(GATED_JOB_NAMES, `${name} must be a gate job`).toContain(name);
      }
    }
  });

  it("closes the gate with the canonical statement, and the deep-clean statement is reversible", async () => {
    // Reset to the post-migration state, then run the one canonical gate
    // statement the migration, the checklist and OPERATIONS.md all embed.
    await staging.db.exec(`update cron.job set active = true`);
    await staging.db.exec(GATE_SQL);

    const inactive = await rows<{ jobname: string }>(
      staging.db,
      `select jobname from cron.job where not active order by jobname`,
    );
    expect(inactive.map((row) => row.jobname)).toEqual([...GATED_JOB_NAMES].sort());
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where active`)).toBe(6);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where not active`)).toBe(8);

    // Resume everything: one statement, reversible, deletes nothing.
    await staging.db.exec(`update cron.job set active = true`);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where active`)).toBe(14);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job`)).toBe(14);

    // Stop everything: the documented "stop all automation" form.
    await staging.db.exec(`update cron.job set active = false`);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job where active`)).toBe(0);
    expect(await scalar<number>(staging.db, `select count(*)::int from cron.job`)).toBe(14);

    // The API form for a single job (pg_cron 1.4+) also works, for the role
    // that owns the job: alter_job is REVOKEd from public.
    await staging.db.exec(`select cron.alter_job(jobid, active := true) from cron.job where jobname = 'write-desk'`);
    expect(await scalar<boolean>(staging.db, `select active from cron.job where jobname = 'write-desk'`)).toBe(true);

    // Leave the database in the post-migration state for the tests below.
    await staging.db.exec(`update cron.job set active = false`);
    await staging.db.query(`update cron.job set active = true where jobname = any($1)`, [SAFE_JOB_NAMES]);
  });

  it("replaces the previous schedule rather than stacking a second one", async () => {
    // The migration unschedules the Phase 5 job names first; a re-run must not
    // leave two jobs pointing at the same function.
    const duplicated = await rows<{ jobname: string; n: number }>(
      staging.db,
      `select jobname, count(*)::int as n from cron.job where jobname is not null group by jobname having count(*) > 1`,
    );
    expect(duplicated).toEqual([]);

    const retired = ["validate-feeds", "auto-publish", "newsroom-monitor", "publish-scheduler-legacy"];
    const leftover = await rows<{ jobname: string }>(
      staging.db,
      `select jobname from cron.job where jobname = any($1)`,
      [retired],
    );
    // The Phase 5 job names the migration unschedules must not reappear.
    expect(leftover).toEqual([]);

    // ...while the Phase 5 helpers the app already relied on stay wired up.
    const helpers = await rows<{ jobname: string; command: string }>(
      staging.db,
      `select jobname, command from cron.job where jobname in ('auto-publish-morning','breaking-news-monitor','notifications-dispatcher')`,
    );
    expect(helpers).toHaveLength(3);
    expect(helpers.every((h) => /public\.(trigger_auto_publish|trigger_breaking_news_monitor|trigger_notifications_dispatcher)\(/.test(h.command))).toBe(true);
  });

  it("posts to the right URL with the Vault secret and never logs the value", async () => {
    const secretValue = "test-secret-value-not-a-real-credential";
    await staging.db.exec(`select vault.create_secret('${secretValue}', 'auto_publish_secret', 'staging test')`);

    const requestId = await scalar<bigint>(
      staging.db,
      `select public.newsroom_trigger('write-desk', '{"limit":1}'::jsonb, 60000)`,
    );
    expect(Number(requestId)).toBeGreaterThan(0);

    const captured = await rows<{ url: string; headers: Record<string, string>; body: Record<string, unknown>; timeout_ms: number }>(
      staging.db,
      `select url, headers, body, timeout_ms from net.captured_requests where id = $1`,
      [Number(requestId)],
    );
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe("https://ruusbjlabbojpbawbphc.supabase.co/functions/v1/write-desk");
    expect(captured[0].headers["Content-Type"]).toBe("application/json");
    expect(captured[0].headers.Authorization).toBe(`Bearer ${secretValue}`);
    expect(captured[0].body).toEqual({ limit: 1 });
    expect(captured[0].timeout_ms).toBe(60000);

    // The secret lives only in Vault: not in the migrations, not in the repo.
    const migrationText = readMigration(PHASE6_CRONS);
    expect(migrationText).not.toContain(secretValue);
    expect(migrationText).not.toContain("Bearer eyJ");
    expect(readFileSync(join(MIGRATIONS_DIR, PHASE6_SCHEMA), "utf8")).not.toContain(secretValue);
  });

  it("respects a custom base URL from Vault and warns when the secret is absent", async () => {
    await staging.db.exec(`select vault.create_secret('https://staging.example.co', 'newsroom_base_url', 'staging')`);
    const id = await scalar<bigint>(staging.db, `select public.newsroom_trigger('ingest-feeds')`);
    const url = await scalar<string>(
      staging.db,
      `select url from net.captured_requests where id = $1`,
      [Number(id)],
    );
    expect(url).toBe("https://staging.example.co/functions/v1/ingest-feeds");

    // Missing secret → the request is still attempted with an empty bearer and
    // Postgres raises a warning; the function must not crash the cron job.
    await staging.db.exec(`delete from vault.secrets where name = 'auto_publish_secret'`);
    await expect(staging.db.exec(`select public.newsroom_trigger('ingest-feeds')`)).resolves.not.toThrow();
    const bearer = await scalar<string>(
      staging.db,
      `select headers->>'Authorization' from net.captured_requests order by id desc limit 1`,
    );
    expect(bearer).toBe("Bearer ");
  });
});
