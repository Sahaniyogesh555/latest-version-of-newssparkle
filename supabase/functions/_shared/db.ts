// Database access for the autonomous newsroom.
//
// Two layers:
//   1. `NewsroomDb` — the exact set of queries the pipeline needs. Small enough
//      to fake in tests, explicit enough to audit (every write is listed).
//   2. `createSupabaseDb` — the only place that talks to PostgREST.
//
// Everything here is service-role only; the Phase 6 migration revokes all
// privileges on the automation tables from anon and authenticated.
//
// bigint columns (simhash) are sent as strings and parsed with BigInt: a 64-bit
// simhash does not survive a JS number round-trip, and a corrupted hash would
// silently break duplicate detection.

/* eslint-disable @typescript-eslint/no-explicit-any */

export class DbError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "DbError";
  }
}

/** Minimal structural view of the supabase-js client (kept loose on purpose). */
export interface SupabaseClientLike {
  from(table: string): any;
  rpc(name: string, args?: Record<string, unknown>): any;
}

export interface SourceRow {
  id: string;
  name: string;
  url: string;
  kind: string;
  category_slug: string | null;
  trust_tier: number;
  language: string;
  active: boolean;
  consecutive_failures: number;
  disabled_until: string | null;
  items_seen: number;
  last_success_at: string | null;
}

export interface IngestedRow {
  id: string;
  fingerprint: string;
  simhash: number | string | null;
  title: string;
  url: string | null;
  snippet: string | null;
  source_id: string | null;
  source_name: string;
  trust_tier: number;
  corroboration: number;
  corroborating: unknown[];
  category_slug: string | null;
  published_at: string | null;
  trend_score: number | string;
  status: string;
  attempts: number;
  reject_reason?: string | null;
}

export interface PostRow {
  id: string;
  title: string;
  slug: string;
  category_slug: string | null;
  status: string;
  simhash: number | string | null;
  published_at: string | null;
  scheduled_for: string | null;
  content?: string | null;
  featured_image_url?: string | null;
  source_refs?: unknown[] | null;
  quality_score?: number | null;
  views?: number | null;
  word_count?: number | null;
  published_by?: string | null;
}

export interface NewIngestedItem {
  fingerprint: string;
  simhash?: string | null;
  title: string;
  url?: string | null;
  snippet?: string | null;
  source_id?: string | null;
  source_name: string;
  trust_tier: number;
  category_slug?: string | null;
  category_confidence?: number | null;
  category_method?: string | null;
  language?: string;
  published_at?: string | null;
  trend_score?: number;
  /** How many feeds carried this story when it was first queued. */
  corroboration?: number;
  corroborating?: string[];
}

export interface NewPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  key_takeaways: string[];
  faq: Array<{ q: string; a: string }>;
  category_slug: string;
  author: string;
  status: string;
  reading_minutes: number;
  published_at?: string | null;
  scheduled_for?: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  image_credit?: string | null;
  image_credit_url?: string | null;
  quality_score?: number | null;
  quality_report?: Record<string, unknown> | null;
  dedupe_fingerprint?: string | null;
  simhash?: string | null;
  word_count?: number | null;
  review_reason?: string | null;
  published_by?: string;
  ai_model?: string | null;
  source_refs?: Array<Record<string, unknown>>;
  source_category?: string | null;
}

export interface PipelineRunInput {
  function: string;
  edition?: string | null;
  ok: boolean;
  items_in?: number;
  items_out?: number;
  llm_calls?: number;
  duration_ms?: number;
  metrics?: Record<string, unknown>;
  error?: string | null;
}

export interface AlertInput {
  code: string;
  message: string;
  severity?: "info" | "warning" | "critical";
  subject?: string | null;
  context?: Record<string, unknown>;
}

export interface HealthCheckInput {
  kind: string;
  ok: boolean;
  checked: number;
  findings: unknown[];
  counts: Record<string, unknown>;
  duration_ms?: number;
}

export interface TrendRow {
  topic: string;
  topic_key: string;
  category_slug: string | null;
  score: number;
  source: string;
  evidence: Record<string, unknown>;
}

export interface NewsroomDb {
  /* sources */
  listActiveSources(): Promise<SourceRow[]>;
  markSourceSuccess(id: string, itemsSeen: number, at: Date): Promise<void>;
  markSourceFailure(
    id: string,
    failure: { error: string; consecutiveFailures: number; disabledUntil: string | null; at: Date },
  ): Promise<void>;

  /* candidates */
  insertIngestedItems(items: NewIngestedItem[]): Promise<number>;
  findIngestedByFingerprints(fingerprints: string[]): Promise<IngestedRow[]>;
  bumpCorroboration(id: string, corroborating: unknown[], corroboration: number): Promise<void>;
  claimIngested(limit: number): Promise<IngestedRow[]>;
  /** Read-only queue snapshot (never claims/steals a candidate). */
  listQueuedCandidates(limit: number): Promise<IngestedRow[]>;
  updateIngested(id: string, patch: Record<string, unknown>): Promise<void>;
  countNewCandidates(): Promise<number>;

  /* posts */
  insertPost(post: NewPost): Promise<PostRow>;
  updatePost(id: string, patch: Record<string, unknown>): Promise<void>;
  listPosts(options: {
    statuses?: string[];
    withinDays?: number;
    limit?: number;
    includeContent?: boolean;
    categorySlug?: string | null;
    olderThanDays?: number;
  }): Promise<PostRow[]>;
  listScheduledDue(now: Date, limit: number): Promise<PostRow[]>;
  countPublishedSince(since: Date): Promise<number>;
  countCategoryPublishedSince(category: string, since: Date): Promise<number>;
  publishedTodayByCategory(since: Date): Promise<Record<string, number>>;
  lastPublishedAt(): Promise<string | null>;

  /* telemetry */
  recordPipelineRun(run: PipelineRunInput): Promise<void>;
  recordAlert(alert: AlertInput): Promise<void>;
  recordHealthCheck(check: HealthCheckInput): Promise<void>;
  llmCallsToday(): Promise<number>;
  newsroomStatus(): Promise<Record<string, unknown>>;

  /* trends */
  upsertTrends(rows: TrendRow[]): Promise<number>;
  listLiveTrends(limit: number): Promise<TrendRow[]>;
  markTrendUsed(topicKey: string, categorySlug: string | null): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* bigint helpers                                                             */
/* -------------------------------------------------------------------------- */

/** 64-bit simhash → decimal string for PostgREST (numbers lose precision). */
export function simhashToDb(value: bigint | null | undefined): string | null {
  return typeof value === "bigint" ? value.toString() : null;
}

/** PostgREST may return bigint as a number or a string; normalise to bigint. */
export function simhashFromDb(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(Math.trunc(value));
    const text = String(value).trim();
    return text.length > 0 ? BigInt(text) : null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Supabase implementation                                                    */
/* -------------------------------------------------------------------------- */

async function run<T>(builder: any, context: string): Promise<T | null> {
  const { data, error } = await builder;
  if (error) throw new DbError(`${context}: ${error.message ?? "query failed"}`, error);
  return (data ?? null) as T | null;
}

async function runList<T>(builder: any, context: string): Promise<T[]> {
  const data = await run<T[]>(builder, context);
  return Array.isArray(data) ? data : [];
}

export function createSupabaseDb(client: SupabaseClientLike): NewsroomDb {
  return {
    async listActiveSources() {
      return runList<SourceRow>(
        client
          .from("content_sources")
          .select(
            "id,name,url,kind,category_slug,trust_tier,language,active,consecutive_failures,disabled_until,items_seen,last_success_at",
          )
          .eq("active", true)
          .order("trust_tier", { ascending: true }),
        "listActiveSources",
      );
    },

    async markSourceSuccess(id, itemsSeen, at) {
      await run(
        client
          .from("content_sources")
          .update({
            last_success_at: at.toISOString(),
            consecutive_failures: 0,
            disabled_until: null,
            items_seen: itemsSeen,
          })
          .eq("id", id),
        "markSourceSuccess",
      );
    },

    async markSourceFailure(id, failure) {
      await run(
        client
          .from("content_sources")
          .update({
            last_failure_at: failure.at.toISOString(),
            consecutive_failures: failure.consecutiveFailures,
            disabled_until: failure.disabledUntil,
          })
          .eq("id", id),
        "markSourceFailure",
      );
    },

    async insertIngestedItems(items) {
      if (items.length === 0) return 0;
      const { data, error } = await client
        .from("ingested_items")
        .upsert(items, { onConflict: "fingerprint", ignoreDuplicates: true })
        .select("id");
      if (error) throw new DbError(`insertIngestedItems: ${error.message}`, error);
      return Array.isArray(data) ? data.length : 0;
    },

    async findIngestedByFingerprints(fingerprints) {
      if (fingerprints.length === 0) return [];
      return runList<IngestedRow>(
        client
          .from("ingested_items")
          .select("id,fingerprint,corroboration,corroborating,title,status")
          .in("fingerprint", fingerprints.slice(0, 200)),
        "findIngestedByFingerprints",
      );
    },

    async bumpCorroboration(id, corroborating, corroboration) {
      await run(
        client
          .from("ingested_items")
          .update({ corroboration, corroborating, seen_at: new Date().toISOString() })
          .eq("id", id),
        "bumpCorroboration",
      );
    },

    async claimIngested(limit) {
      return runList<IngestedRow>(
        client.rpc("claim_ingested_items", { p_limit: limit }),
        "claimIngested",
      );
    },

    async listQueuedCandidates(limit) {
      return runList<IngestedRow>(
        client
          .from("ingested_items")
          .select(
            "id,fingerprint,simhash,title,url,snippet,source_id,source_name,trust_tier,category_slug,category_confidence,corroboration,category_method,published_at,trend_score,status,attempts",
          )
          .eq("status", "new")
          .gt("expires_at", new Date().toISOString())
          .order("trend_score", { ascending: false })
          .limit(limit),
        "listQueuedCandidates",
      );
    },

    async updateIngested(id, patch) {
      await run(client.from("ingested_items").update(patch).eq("id", id), "updateIngested");
    },

    async countNewCandidates() {
      const { count, error } = await client
        .from("ingested_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (error) throw new DbError(`countNewCandidates: ${error.message}`, error);
      return count ?? 0;
    },

    async insertPost(post) {
      const row = await run<PostRow>(client.from("posts").insert(post).select("*").single(), "insertPost");
      if (!row) throw new DbError("insertPost: no row returned");
      return row;
    },

    async updatePost(id, patch) {
      await run(client.from("posts").update(patch).eq("id", id), "updatePost");
    },

    async listPosts(options) {
      const base =
        "id,title,slug,category_slug,status,published_at,scheduled_for,simhash,featured_image_url,source_refs,quality_score,views,word_count";
      let query = client.from("posts").select(options.includeContent ? `${base},content` : base);
      if (options.statuses?.length) query = query.in("status", options.statuses);
      if (options.categorySlug) query = query.eq("category_slug", options.categorySlug);
      if (options.withinDays) {
        const since = new Date(Date.now() - options.withinDays * 86_400_000).toISOString();
        query = query.gte("published_at", since);
      }
      if (options.olderThanDays) {
        const before = new Date(Date.now() - options.olderThanDays * 86_400_000).toISOString();
        query = query.lt("published_at", before);
      }
      return runList<PostRow>(
        query.order("published_at", { ascending: false }).limit(options.limit ?? 60),
        "listPosts",
      );
    },

    async listScheduledDue(now, limit) {
      return runList<PostRow>(
        client
          .from("posts")
          .select("id,title,slug,category_slug,status,published_at,scheduled_for,simhash,quality_score")
          .eq("status", "scheduled")
          .lte("scheduled_for", now.toISOString())
          .order("scheduled_for", { ascending: true })
          .limit(limit),
        "listScheduledDue",
      );
    },

    async countPublishedSince(since) {
      const { count, error } = await client
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .gte("published_at", since.toISOString());
      if (error) throw new DbError(`countPublishedSince: ${error.message}`, error);
      return count ?? 0;
    },

    async countCategoryPublishedSince(category, since) {
      const { data, error } = await client.rpc("category_published_count", {
        p_category: category,
        p_since: since.toISOString(),
      });
      if (error) throw new DbError(`countCategoryPublishedSince: ${error.message}`, error);
      return typeof data === "number" ? data : Number(data ?? 0);
    },

    async publishedTodayByCategory(since) {
      const rows = await runList<{ category_slug: string | null }>(
        client
          .from("posts")
          .select("category_slug")
          .in("status", ["published", "scheduled"])
          .gte("published_at", since.toISOString()),
        "publishedTodayByCategory",
      );
      const counts: Record<string, number> = {};
      for (const row of rows) {
        if (!row.category_slug) continue;
        counts[row.category_slug] = (counts[row.category_slug] ?? 0) + 1;
      }
      return counts;
    },

    async lastPublishedAt() {
      const rows = await runList<{ published_at: string | null }>(
        client
          .from("posts")
          .select("published_at")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(1),
        "lastPublishedAt",
      );
      return rows[0]?.published_at ?? null;
    },

    async recordPipelineRun(entry) {
      const { error } = await client.from("pipeline_runs").insert({
        ...entry,
        metrics: entry.metrics ?? {},
        finished_at: new Date().toISOString(),
      });
      // Telemetry must never break publishing.
      if (error) console.error("recordPipelineRun failed:", error.message);
    },

    async recordAlert(alert) {
      const { error } = await client.rpc("record_alert", {
        p_code: alert.code,
        p_message: alert.message.slice(0, 900),
        p_severity: alert.severity ?? "warning",
        p_subject: alert.subject ?? null,
        p_context: alert.context ?? {},
      });
      if (error) console.error("recordAlert failed:", error.message);
    },

    async recordHealthCheck(check) {
      const { error } = await client.from("content_health_checks").insert({
        kind: check.kind,
        ok: check.ok,
        checked: check.checked,
        findings: check.findings,
        counts: check.counts,
        duration_ms: check.duration_ms ?? null,
      });
      if (error) console.error("recordHealthCheck failed:", error.message);
    },

    async llmCallsToday() {
      const { data, error } = await client.rpc("newsroom_llm_calls_today");
      if (error) throw new DbError(`llmCallsToday: ${error.message}`, error);
      return typeof data === "number" ? data : Number(data ?? 0);
    },

    async newsroomStatus() {
      const { data, error } = await client.rpc("newsroom_status");
      if (error) throw new DbError(`newsroomStatus: ${error.message}`, error);
      return (data ?? {}) as Record<string, unknown>;
    },

    async upsertTrends(rows) {
      if (rows.length === 0) return 0;
      const { data, error } = await client
        .from("topic_trends")
        .upsert(rows, { onConflict: "topic_key,category_slug" })
        .select("id");
      if (error) throw new DbError(`upsertTrends: ${error.message}`, error);
      return Array.isArray(data) ? data.length : 0;
    },

    async listLiveTrends(limit) {
      return runList<TrendRow>(
        client
          .from("topic_trends")
          .select("topic,topic_key,category_slug,score,source,evidence")
          .gt("expires_at", new Date().toISOString())
          .order("score", { ascending: false })
          .limit(limit),
        "listLiveTrends",
      );
    },

    async markTrendUsed(topicKey, categorySlug) {
      await run(
        client
          .from("topic_trends")
          .update({ used_at: new Date().toISOString() })
          .eq("topic_key", topicKey)
          .eq("category_slug", categorySlug ?? ""),
        "markTrendUsed",
      );
    },
  };
}
