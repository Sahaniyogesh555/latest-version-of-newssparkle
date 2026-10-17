/**
 * The cron contract for the Phase 6 autonomous newsroom.
 *
 * One source of truth for: which jobs the migration installs, which of them may
 * publish, alert readers or archive published content (the "gate set"), and the
 * exact SQL that closes and opens the gate. The migration, the operator
 * checklist and docs/OPERATIONS.md all embed the same statements, and
 * src/test/phase6-sql.test.ts + src/test/repo-integrity.test.ts assert that
 * every copy normalises to the strings below — so a job list can never drift
 * out of sync with the documentation again.
 *
 * Nothing here redefines a schedule: `schedule` and `command` are copied
 * verbatim from supabase/migrations/20261016090100_phase6_autonomy_crons.sql.
 */

export type JobCategory =
  /** Can end with a live article: it sets status='published' or calls something that does. */
  | "publishing-capable"
  /** Cannot publish, but spends LLM budget and queues posts a later run will release. */
  | "content-generation"
  /** Writes reader-facing notifications about published posts. */
  | "reader-alert"
  /** Mutates published content: repairs images and archives stale articles. */
  | "destructive-maintenance"
  /** Reads/writes only non-public state (candidates, trends, runs, old rows). */
  | "safe-operational";

export interface CronJobSpec {
  name: string;
  /** Cron expression, exactly as the migration writes it. */
  schedule: string;
  /** Job body, whitespace-normalised, exactly as the migration writes it. */
  command: string;
  category: JobCategory;
}

/** All 14 jobs the Phase 6 migration installs. */
export const ALL_JOBS: CronJobSpec[] = [
  // --- gate set: created INACTIVE, enabled only by the documented steps -----
  {
    name: "write-desk",
    schedule: "*/30 * * * *",
    command: "select public.newsroom_trigger('write-desk', '{}'::jsonb, 300000);",
    category: "content-generation",
  },
  {
    name: "publish-scheduler",
    schedule: "*/10 * * * *",
    command: "select public.newsroom_trigger('publish-scheduler', '{}'::jsonb, 90000);",
    category: "publishing-capable",
  },
  {
    name: "auto-publish-morning",
    schedule: "0 6 * * *",
    command: "select public.trigger_auto_publish('morning');",
    category: "publishing-capable",
  },
  {
    name: "auto-publish-midday",
    schedule: "0 12 * * *",
    command: "select public.trigger_auto_publish('midday');",
    category: "publishing-capable",
  },
  {
    name: "auto-publish-evening",
    schedule: "0 18 * * *",
    command: "select public.trigger_auto_publish('evening');",
    category: "publishing-capable",
  },
  {
    name: "breaking-news-monitor",
    schedule: "*/30 * * * *",
    command: "select public.trigger_breaking_news_monitor();",
    category: "publishing-capable",
  },
  {
    name: "notifications-dispatcher",
    schedule: "*/10 * * * *",
    command: "select public.trigger_notifications_dispatcher();",
    category: "reader-alert",
  },
  {
    name: "newsroom-maintenance",
    schedule: "40 * * * *",
    command: "select public.newsroom_trigger('maintenance', '{}'::jsonb, 240000);",
    category: "destructive-maintenance",
  },

  // --- safe set: stay active immediately after the migration ----------------
  {
    name: "ingest-feeds",
    schedule: "*/20 * * * *",
    command: "select public.newsroom_trigger('ingest-feeds', '{}'::jsonb, 120000);",
    category: "safe-operational",
  },
  {
    name: "trend-watch",
    schedule: "15 */3 * * *",
    command: "select public.newsroom_trigger('trend-watch', '{}'::jsonb, 120000);",
    category: "safe-operational",
  },
  {
    name: "phase6-monitor",
    schedule: "5,35 * * * *",
    command: "select public.newsroom_trigger('phase6-monitor', '{}'::jsonb, 60000);",
    category: "safe-operational",
  },
  {
    name: "validate-feeds-daily",
    schedule: "30 4 * * *",
    command: "select public.newsroom_trigger('validate-feeds', '{}'::jsonb, 180000);",
    category: "safe-operational",
  },
  {
    name: "prune-post-view-events",
    schedule: "15 3 * * *",
    command: "select public.prune_post_view_events();",
    category: "safe-operational",
  },
  {
    name: "prune-automation",
    schedule: "25 3 * * *",
    command: "select public.prune_automation_tables();",
    category: "safe-operational",
  },
];

/** Job names, in migration order. */
export const ALL_JOB_NAMES = ALL_JOBS.map((job) => job.name);

/** The jobs that must NOT run before an operator completes the preflight. */
export const GATED_JOBS = ALL_JOBS.filter((job) => job.category !== "safe-operational");

/** The jobs that keep running unattended: ingestion, monitoring, retention. */
export const SAFE_JOBS = ALL_JOBS.filter((job) => job.category === "safe-operational");

export const GATED_JOB_NAMES = GATED_JOBS.map((job) => job.name);
export const SAFE_JOB_NAMES = SAFE_JOBS.map((job) => job.name);

export function jobsInCategory(category: JobCategory): CronJobSpec[] {
  return ALL_JOBS.filter((job) => job.category === category);
}

/**
 * The gate: the single statement that closes it. Embedded verbatim (modulo
 * indentation) in the migration, the checklist and docs/OPERATIONS.md.
 */
export const GATE_SQL = [
  "select cron.alter_job(jobid, active => false)",
  "  from cron.job",
  " where jobname in ('write-desk','publish-scheduler',",
  "                   'auto-publish-morning','auto-publish-midday','auto-publish-evening',",
  "                   'breaking-news-monitor','notifications-dispatcher',",
  "                   'newsroom-maintenance');",
].join("\n");

/**
 * Why `cron.alter_job` and not `update cron.job set active = ...`:
 *
 * Supabase grants the `postgres` role SELECT only on `cron.job`
 * (supabase/postgres 20231020085357_revoke_writes_on_cron_job_from_postgres.sql,
 * re-applied by extensions.grant_pg_cron_access() when pg_cron is created).
 * A direct UPDATE therefore fails with "permission denied for table job" and
 * would abort `supabase db push` at this statement.
 *
 * cron.alter_job(job_id, schedule, command, database, username, active) is the
 * supported API (pg_cron 1.4+, REVOKEd from public, granted by Supabase to
 * `postgres`). It runs the UPDATE as the extension owner and only touches the
 * arguments that are not NULL, so `active => false` flips the flag and leaves
 * the schedule and command exactly as they are.
 */
export const GATE_RATIONALE =
  "cron.alter_job is the supported API: postgres has SELECT only on cron.job.";

/** Resume everything, including the safe jobs. */
export const RESUME_ALL_SQL = "select cron.alter_job(jobid, active => true) from cron.job;";

/** Stop everything (ingestion and monitoring too) — reversible, deletes nothing. */
export const STOP_ALL_SQL = "select cron.alter_job(jobid, active => false) from cron.job;";

/** Human-readable expectation that both docs must state, and the test asserts. */
export const GATE_EXPECTATION =
  `${GATED_JOB_NAMES.length} of ${ALL_JOBS.length} jobs inactive (gated)` +
  ` / ${SAFE_JOB_NAMES.length} active (safe)`;

export interface ActivationStep {
  /** Section id in phase6_activation_checklist.txt. */
  id: string;
  /** What the operator is approving by running it. */
  enables: string[];
  /** SQL exactly as the checklist writes it. */
  sql: string;
  /** Active gate jobs after this step, cumulative. */
  activeAfter: string[];
}

/**
 * The three documented enablement steps, in order. Publishing first, reader
 * alerts next, and the archive sweep only after the operator has reviewed the
 * rows it would touch.
 */
export const ACTIVATION_STEPS: ActivationStep[] = [
  {
    id: "G1",
    enables: ["write-desk", "publish-scheduler"],
    sql: [
      "select cron.alter_job(jobid, active => true) from cron.job",
      " where jobname in ('write-desk','publish-scheduler');",
    ].join("\n"),
    activeAfter: ["write-desk", "publish-scheduler"],
  },
  {
    id: "G2",
    enables: [
      "auto-publish-morning",
      "auto-publish-midday",
      "auto-publish-evening",
      "breaking-news-monitor",
      "notifications-dispatcher",
    ],
    sql: [
      "select cron.alter_job(jobid, active => true) from cron.job",
      " where jobname in ('auto-publish-morning','auto-publish-midday','auto-publish-evening',",
      "                   'breaking-news-monitor','notifications-dispatcher');",
    ].join("\n"),
    activeAfter: [
      "write-desk",
      "publish-scheduler",
      "auto-publish-morning",
      "auto-publish-midday",
      "auto-publish-evening",
      "breaking-news-monitor",
      "notifications-dispatcher",
    ],
  },
  {
    id: "G3",
    enables: ["newsroom-maintenance"],
    sql: [
      "select cron.alter_job(jobid, active => true) from cron.job",
      " where jobname in ('newsroom-maintenance');",
    ].join("\n"),
    activeAfter: GATED_JOB_NAMES,
  },
];

/** Whitespace-normalised comparison key, so indentation never matters. */
export function normaliseSql(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extract every `select cron.alter_job(jobid, active => <value>) …;` statement
 * from a document, normalised. Used to prove that the migrations and both docs
 * contain the same statements and no stray variations.
 *
 * `update cron.job set active = …` is deliberately NOT matched: that form is
 * not executable by the role Supabase gives you, and repo-integrity fails if it
 * appears anywhere.
 */
export function extractActiveStatements(text: string, value: "true" | "false"): string[] {
  const pattern = new RegExp(
    `select\\s+cron\\.alter_job\\(\\s*jobid\\s*,\\s*active\\s*=>\\s*${value}\\s*\\)[\\s\\S]*?;`,
    "gi",
  );
  return [...text.matchAll(pattern)].map((match) => normaliseSql(match[0]));
}

/** Job names inside an `update cron.job … where jobname in (…)` statement. */
export function jobNamesInStatement(statement: string): string[] {
  const match = statement.match(/where jobname in \(([^)]*)\)/i);
  if (!match) return [];
  return [...match[1].matchAll(/'([a-z0-9-]+)'/g)].map((entry) => entry[1]);
}
