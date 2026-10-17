// In-memory NewsroomDb used to exercise the pipeline without Postgres.
//
// It implements the same interface the Supabase client does, records every
// write so tests can assert on behaviour, and models the two behaviours the
// pipeline depends on: fingerprint-level uniqueness on ingest, and an atomic
// claim that hands a candidate to exactly one run.

import type {
  AlertInput,
  HealthCheckInput,
  IngestedRow,
  NewsroomDb,
  NewIngestedItem,
  NewPost,
  PipelineRunInput,
  PostRow,
  SourceRow,
  TrendRow,
} from "../../../supabase/functions/_shared/db.ts";

export interface FakeDbState {
  sources: SourceRow[];
  ingested: IngestedRow[];
  posts: (PostRow & { word_count?: number | null })[];
  trends: TrendRow[];
  runs: PipelineRunInput[];
  alerts: AlertInput[];
  health: HealthCheckInput[];
  llmCallsToday: number;
  status: Record<string, unknown>;
  inserts: NewPost[];
  updates: Array<{ table: string; id: string; patch: Record<string, unknown> }>;
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export function createFakeDb(seed: Partial<FakeDbState> = {}): { db: NewsroomDb; state: FakeDbState } {
  const state: FakeDbState = {
    sources: seed.sources ?? [],
    ingested: seed.ingested ?? [],
    posts: seed.posts ?? [],
    trends: seed.trends ?? [],
    runs: seed.runs ?? [],
    alerts: seed.alerts ?? [],
    health: seed.health ?? [],
    llmCallsToday: seed.llmCallsToday ?? 0,
    status: seed.status ?? {},
    inserts: seed.inserts ?? [],
    updates: seed.updates ?? [],
  };

  const db: NewsroomDb = {
    async listActiveSources() {
      return state.sources.map((source) => ({ ...source }));
    },

    async markSourceSuccess(id, itemsSeen) {
      const source = state.sources.find((entry) => entry.id === id);
      if (source) {
        source.consecutive_failures = 0;
        source.disabled_until = null;
        source.items_seen = itemsSeen;
        source.last_success_at = new Date().toISOString();
      }
    },

    async markSourceFailure(id, failure) {
      const source = state.sources.find((entry) => entry.id === id);
      if (source) {
        source.consecutive_failures = failure.consecutiveFailures;
        source.disabled_until = failure.disabledUntil;
      }
      state.updates.push({ table: "content_sources", id, patch: { ...failure } });
    },

    async insertIngestedItems(items: NewIngestedItem[]) {
      let inserted = 0;
      for (const item of items) {
        if (state.ingested.some((row) => row.fingerprint === item.fingerprint)) continue;
        state.ingested.push({
          id: nextId("ing"),
          fingerprint: item.fingerprint,
          simhash: item.simhash ?? null,
          title: item.title,
          url: item.url ?? null,
          snippet: item.snippet ?? null,
          source_id: item.source_id ?? null,
          source_name: item.source_name,
          trust_tier: item.trust_tier,
          corroboration: item.corroboration ?? 1,
          corroborating: item.corroborating ?? [],
          category_slug: item.category_slug ?? null,
          published_at: item.published_at ?? null,
          trend_score: item.trend_score ?? 0,
          status: "new",
          attempts: 0,
        });
        inserted++;
      }
      return inserted;
    },

    async findIngestedByFingerprints(fingerprints) {
      return state.ingested.filter((row) => fingerprints.includes(row.fingerprint)).map((row) => ({ ...row }));
    },

    async bumpCorroboration(id, corroborating, corroboration) {
      const row = state.ingested.find((entry) => entry.id === id);
      if (row) {
        row.corroborating = corroborating;
        row.corroboration = corroboration;
      }
    },

    async claimIngested(limit) {
      const claimed = state.ingested.filter((row) => row.status === "new").slice(0, Math.max(limit, 1));
      for (const row of claimed) {
        row.status = "processing";
        row.attempts += 1;
      }
      return claimed.map((row) => ({ ...row }));
    },

    async listQueuedCandidates(limit) {
      return state.ingested.filter((row) => row.status === "new").slice(0, limit).map((row) => ({ ...row }));
    },

    async updateIngested(id, patch) {
      const row = state.ingested.find((entry) => entry.id === id);
      if (row) Object.assign(row, patch);
      state.updates.push({ table: "ingested_items", id, patch });
    },

    async countNewCandidates() {
      return state.ingested.filter((row) => row.status === "new").length;
    },

    async insertPost(post) {
      const row: PostRow = {
        id: nextId("post"),
        title: post.title,
        slug: post.slug,
        category_slug: post.category_slug,
        status: post.status,
        simhash: post.simhash ?? null,
        published_at: post.published_at ?? null,
        scheduled_for: post.scheduled_for ?? null,
        content: post.content,
        featured_image_url: post.featured_image_url ?? null,
        source_refs: post.source_refs ?? null,
        quality_score: post.quality_score ?? null,
        views: 0,
        word_count: post.word_count ?? null,
        published_by: post.published_by ?? null,
      };
      state.posts.push(row);
      state.inserts.push(post);
      return row;
    },

    async updatePost(id, patch) {
      const row = state.posts.find((entry) => entry.id === id);
      if (row) Object.assign(row, patch);
      state.updates.push({ table: "posts", id, patch });
    },

    async listPosts(options) {
      let rows = [...state.posts];
      if (options.statuses?.length) rows = rows.filter((row) => options.statuses!.includes(row.status));
      if (options.categorySlug) rows = rows.filter((row) => row.category_slug === options.categorySlug);
      if (options.withinDays) {
        const since = Date.now() - options.withinDays * 86_400_000;
        rows = rows.filter((row) => (row.published_at ? Date.parse(row.published_at) >= since : false));
      }
      return rows
        .slice(0, options.limit ?? 60)
        .map((row) => (options.includeContent ? { ...row } : { ...row, content: undefined }));
    },

    async listScheduledDue(now, limit) {
      return state.posts
        .filter((row) => row.status === "scheduled" && row.scheduled_for && Date.parse(row.scheduled_for) <= now.getTime())
        .slice(0, limit)
        .map((row) => ({ ...row }));
    },

    async countPublishedSince(since) {
      return state.posts.filter(
        (row) => row.status === "published" && row.published_at && Date.parse(row.published_at) >= since.getTime(),
      ).length;
    },

    async countCategoryPublishedSince(category, since) {
      return state.posts.filter(
        (row) =>
          row.status === "published" &&
          row.category_slug === category &&
          row.published_at &&
          Date.parse(row.published_at) >= since.getTime(),
      ).length;
    },

    async publishedTodayByCategory(since) {
      const counts: Record<string, number> = {};
      for (const row of state.posts) {
        if (!["published", "scheduled"].includes(row.status)) continue;
        const stamp = row.published_at ?? row.scheduled_for;
        if (!stamp || Date.parse(stamp) < since.getTime() || !row.category_slug) continue;
        counts[row.category_slug] = (counts[row.category_slug] ?? 0) + 1;
      }
      return counts;
    },

    async lastPublishedAt() {
      const published = state.posts.filter((row) => row.status === "published" && row.published_at);
      if (published.length === 0) return null;
      return published.map((row) => row.published_at as string).sort().reverse()[0];
    },

    async recordPipelineRun(run) {
      state.runs.push(run);
    },

    async recordAlert(alert) {
      state.alerts.push(alert);
    },

    async recordHealthCheck(check) {
      state.health.push(check);
    },

    async llmCallsToday() {
      return state.llmCallsToday;
    },

    async newsroomStatus() {
      return state.status;
    },

    async upsertTrends(rows) {
      let count = 0;
      for (const row of rows) {
        const existing = state.trends.find(
          (entry) => entry.topic_key === row.topic_key && entry.category_slug === row.category_slug,
        );
        if (existing) Object.assign(existing, row);
        else state.trends.push({ ...row });
        count++;
      }
      return count;
    },

    async listLiveTrends(limit) {
      return state.trends.slice(0, limit).map((row) => ({ ...row }));
    },

    async markTrendUsed(topicKey) {
      const row = state.trends.find((entry) => entry.topic_key === topicKey);
      if (row) row.evidence = { ...row.evidence, used: true };
    },
  };

  return { db, state };
}

export function sourceFixture(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    id: overrides.id ?? nextId("src"),
    name: "BBC World",
    url: "https://feeds.example.com/world.xml",
    kind: "rss",
    category_slug: "world",
    trust_tier: 1,
    language: "en",
    active: true,
    consecutive_failures: 0,
    disabled_until: null,
    items_seen: 0,
    last_success_at: null,
    ...overrides,
  };
}

export function ingestedFixture(overrides: Partial<IngestedRow> = {}): IngestedRow {
  return {
    id: overrides.id ?? nextId("ing"),
    fingerprint: "fp",
    simhash: null,
    title: "Energy regulator reports 12% rise in wholesale prices",
    url: "https://example.com/story",
    snippet: "The regulator said wholesale energy prices rose 12% in March, adding 180 pounds to a typical bill.",
    source_id: "src-1",
    source_name: "BBC World",
    trust_tier: 1,
    corroboration: 1,
    corroborating: [],
    category_slug: "business",
    published_at: new Date().toISOString(),
    trend_score: 0,
    status: "new",
    attempts: 0,
    ...overrides,
  };
}

export function scheduledPostFixture(overrides: Partial<PostRow> = {}): PostRow {
  return {
    id: overrides.id ?? nextId("post"),
    title: "Central bank holds rates steady",
    slug: "central-bank-holds-rates-steady",
    category_slug: "business",
    status: "scheduled",
    simhash: null,
    published_at: null,
    scheduled_for: new Date(Date.now() - 60_000).toISOString(),
    content: "Body",
    quality_score: 82,
    ...overrides,
  };
}
