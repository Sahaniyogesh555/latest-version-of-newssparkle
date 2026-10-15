/**
 * Phase 6 — pipeline orchestration, exercised end to end against an in-memory
 * database, recorded AI responses and a fake network. This is the closest we
 * can get to running the Deno functions locally, and it covers the behaviour
 * that matters when nobody is watching: what gets published, what gets held,
 * and what happens when a dependency dies.
 */
import { describe, it, expect, vi } from "vitest";
import {
  DESK_BY_CATEGORY,
  loadLiveTrends,
  runIngest,
  runMaintenance,
  runMonitor,
  runPublishScheduler,
  runTrendWatch,
  runWriteDesk,
  type PipelineDeps,
} from "../../supabase/functions/_shared/pipeline.ts";
import { PUBLISH_LIMITS } from "../../supabase/functions/_shared/schedule.ts";
import type { AiConfig } from "../../supabase/functions/_shared/ai.ts";
import { createFakeDb, ingestedFixture, scheduledPostFixture, sourceFixture } from "./fixtures/fake-db.ts";
import {
  FIXTURE_SOURCES,
  VERIFIER_REJECTED,
  VERIFIER_SUPPORTED,
  WRITER_FENCED,
  WRITER_GOOD,
  WRITER_UNSUPPORTED_FIGURE,
  WRITER_UNPARSEABLE,
} from "./fixtures/ai-responses.ts";

const AI: AiConfig = { apiKey: "test", baseUrl: "https://ai.example.com/v1", model: "gpt-4o-mini" };

/** The pipeline clock is injected, so fixtures must be relative to it. */
const NOW = new Date("2026-10-16T13:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

/** Chat-completions stub: writer prompt → article, verifier prompt → verdict. */
function aiFetch(responses: { writer?: string; verifier?: string; alt?: string; headlines?: string }) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/chat/completions")) {
      const body = String(init?.body ?? "");
      const isVerifier = body.includes("fact-checking editor");
      const isAlt = body.includes("alt text");
      const isHeadline = body.includes("Write 3 alternative headlines");
      const content = isVerifier
        ? (responses.verifier ?? VERIFIER_SUPPORTED.response)
        : isAlt
          ? (responses.alt ?? JSON.stringify({ alt: "A gas meter on the outside wall of a terraced house" }))
          : isHeadline
            ? (responses.headlines ?? JSON.stringify({ headlines: [] }))
            : (responses.writer ?? WRITER_GOOD.response);
      return new Response(
        JSON.stringify({ model: "gpt-4o-mini", choices: [{ message: { content } }], usage: { prompt_tokens: 800, completion_tokens: 700 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

function deps(overrides: Partial<PipelineDeps> & { db: PipelineDeps["db"] }): PipelineDeps {
  return {
    ai: AI,
    images: {},
    now: NOW,
    siteUrl: "https://newssparkle.example",
    log: () => {},
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Ingest                                                                     */
/* -------------------------------------------------------------------------- */

const RSS_GOOD = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item>
    <title><![CDATA[Energy regulator reports 12% rise in wholesale prices]]></title>
    <link>https://example.com/energy</link>
    <description>Wholesale energy prices rose 12% in March, adding around 180 pounds to a typical annual bill, the regulator said.</description>
    <pubDate>Fri, 16 Oct 2026 09:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Subscribe to our newsletter for the best morning coverage</title>
    <link>https://example.com/newsletter</link>
    <description>Get the best of our journalism in your inbox every morning, with analysis and comment.</description>
    <pubDate>Fri, 16 Oct 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Emergency crews restore power after overnight storms hit the coast</title>
    <link>https://example.com/storm</link>
    <description>Crews worked through the night after storms brought down trees and damaged substations across three counties.</description>
    <pubDate>Fri, 16 Oct 2026 07:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

describe("ingest-feeds", () => {
  it("keeps valid stories, rejects feed furniture and records source health", async () => {
    const { db, state } = createFakeDb({ sources: [sourceFixture()] });
    const fetchImpl = vi.fn(async () => new Response(RSS_GOOD, { status: 200 })) as unknown as typeof fetch;

    const summary = await runIngest(deps({ db, fetchImpl }), { maxItemsPerSource: 10 });

    expect(summary.ok).toBe(true);
    expect(summary.itemsIn).toBe(3);
    expect(summary.itemsOut).toBe(2);
    expect(state.ingested).toHaveLength(2);
    expect(state.ingested.every((row) => row.status === "new")).toBe(true);
    expect(state.ingested[0].category_slug).toBeTruthy();
    expect(state.ingested.every((row) => row.simhash !== null)).toBe(true);

    const rejected = summary.metrics.rejected_sample as Array<{ reason: string }>;
    expect(rejected.some((item) => item.reason.includes("promotional"))).toBe(true);
    expect(state.sources[0].consecutive_failures).toBe(0);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].function).toBe("ingest-feeds");
  });

  it("collapses the same story from two wires into one corroborated candidate", async () => {
    const sources = [
      sourceFixture({ name: "BBC World", trust_tier: 2, url: "https://feeds.example.com/a.xml" }),
      sourceFixture({ name: "Reuters", trust_tier: 1, url: "https://feeds.example.com/b.xml" }),
    ];
    const { db, state } = createFakeDb({ sources });
    const fetchImpl = vi.fn(async () => new Response(RSS_GOOD, { status: 200 })) as unknown as typeof fetch;

    await runIngest(deps({ db, fetchImpl }), { maxItemsPerSource: 10 });

    // Two sources × two valid stories, deduplicated by headline.
    expect(state.ingested).toHaveLength(2);
    const energy = state.ingested.find((row) => row.title.includes("Energy regulator"));
    expect(energy?.corroboration).toBeGreaterThanOrEqual(2);
    expect((energy?.corroborating as string[]).length).toBeGreaterThanOrEqual(1);
  });

  it("parks a failing feed and alerts after repeated failures", async () => {
    const { db, state } = createFakeDb({
      sources: [sourceFixture({ consecutive_failures: 2, name: "Broken Wire" })],
    });
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;

    const summary = await runIngest(deps({ db, fetchImpl }));

    expect(summary.ok).toBe(false);
    expect(summary.errors[0]).toContain("Broken Wire");
    expect(state.sources[0].consecutive_failures).toBe(3);
    expect(state.sources[0].disabled_until).not.toBeNull();
    expect(state.alerts.some((alert) => alert.code === "feed-disabled")).toBe(true);
    expect(state.ingested).toHaveLength(0);
  });

  it("skips feeds that are inside their cooldown window", async () => {
    const { db } = createFakeDb({
      sources: [
        sourceFixture({ disabled_until: "2026-10-16T20:00:00Z" }),
        sourceFixture({ id: "src-live", name: "Live Wire", url: "https://feeds.example.com/live.xml" }),
      ],
    });
    const fetchImpl = vi.fn(async () => new Response(RSS_GOOD, { status: 200 })) as unknown as typeof fetch;

    const summary = await runIngest(deps({ db, fetchImpl }));

    expect(summary.metrics.sources_checked).toBe(1);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("never throws when a feed returns garbage", async () => {
    const { db, state } = createFakeDb({ sources: [sourceFixture()] });
    const fetchImpl = vi.fn(async () => new Response("<html>not a feed</html>", { status: 200 })) as unknown as typeof fetch;

    const summary = await runIngest(deps({ db, fetchImpl }));

    expect(summary.itemsOut).toBe(0);
    expect(state.ingested).toHaveLength(0);
    expect(state.sources[0].consecutive_failures).toBe(0); // served fine, just useless
  });
});

/* -------------------------------------------------------------------------- */
/* Write desk                                                                 */
/* -------------------------------------------------------------------------- */

describe("write-desk", () => {
  const ready = () =>
    createFakeDb({
      ingested: [ingestedFixture()],
      llmCallsToday: 0,
    });

  it("writes, verifies, scores and schedules a story", async () => {
    const { db, state } = ready();
    const summary = await runWriteDesk(deps({ db, fetchImpl: aiFetch({}) }), { edition: "midday" });

    expect(summary.ok).toBe(true);
    expect(summary.itemsOut).toBe(1);
    expect(state.inserts).toHaveLength(1);

    const post = state.inserts[0];
    expect(post.status).toBe("scheduled");
    expect(post.scheduled_for).toBeTruthy();
    expect(post.quality_score).toBeGreaterThanOrEqual(75);
    expect(post.published_by).toBe("automation");
    expect(post.author).toBe(DESK_BY_CATEGORY.business);
    expect(post.slug).toMatch(/^[a-z0-9-]+$/);
    expect(post.featured_image_url).toBeTruthy();
    expect(post.featured_image_alt?.length).toBeGreaterThan(10);
    expect(post.simhash).toBeTruthy();
    expect(post.dedupe_fingerprint).toBeTruthy();
    expect((post.source_refs as unknown[]).length).toBe(1);
    expect(post.quality_report?.schema).toBeTruthy();

    // Dry-run contract for the Phase 6.1 activation steps: a freshly written
    // story must NOT become due the moment it is written. nextSlot() aligns the
    // post with the edition plan, so the earliest it can be released is one
    // minimum gap (25 min) after the write. An operator following the smoke
    // test therefore must wait for that slot (or force it explicitly) — running
    // publish-scheduler in the same minute is supposed to publish nothing.
    const deltaMinutes = (Date.parse(String(post.scheduled_for)) - NOW.getTime()) / 60_000;
    expect(deltaMinutes).toBeGreaterThanOrEqual(24);
    expect(deltaMinutes).toBeLessThanOrEqual(PUBLISH_LIMITS.maxLookaheadHours * 60);

    // The candidate is consumed, and a telemetry row is written.
    expect(state.ingested[0].status).toBe("used");
    expect(state.runs[0].llm_calls).toBeGreaterThanOrEqual(2);
  });

  it("holds a draft in review when the verifier cannot confirm it", async () => {
    const { db, state } = ready();
    const summary = await runWriteDesk(deps({ db, fetchImpl: aiFetch({ verifier: VERIFIER_REJECTED.response }) }), {
      edition: "midday",
    });

    expect(summary.itemsOut).toBe(1);
    expect(state.inserts[0].status).toBe("review");
    expect(state.inserts[0].review_reason).toBeTruthy();
    expect(state.alerts.some((alert) => alert.code === "post-needs-review")).toBe(true);
    expect(state.runs[0].metrics.review).toBe(1);
  });

  it("rejects a draft with figures the sources do not support", async () => {
    const { db, state } = ready();
    await runWriteDesk(deps({ db, fetchImpl: aiFetch({ writer: WRITER_UNSUPPORTED_FIGURE.response }) }), {
      edition: "midday",
    });

    expect(state.inserts[0].status).toBe("rejected");
    expect(state.inserts[0].quality_score).toBeLessThan(75);
    expect(state.ingested[0].status).toBe("rejected");
    expect(state.ingested[0].reject_reason).toBe("quality-gate");
  });

  it("drops an unparseable model response without creating a post", async () => {
    const { db, state } = ready();
    const summary = await runWriteDesk(deps({ db, fetchImpl: aiFetch({ writer: WRITER_UNPARSEABLE.response }) }), {
      edition: "midday",
    });

    expect(state.inserts).toHaveLength(0);
    expect(state.ingested[0].status).toBe("rejected");
    expect(state.ingested[0].reject_reason).toBe("unparseable-model-output");
    expect(summary.itemsOut).toBe(0);
  });

  it("stops instead of inventing content when no AI key is configured", async () => {
    const { db, state } = ready();
    const summary = await runWriteDesk(deps({ db, ai: null }), { edition: "midday" });

    expect(summary.ok).toBe(false);
    expect(summary.errors).toContain("ai-not-configured");
    expect(state.inserts).toHaveLength(0);
    expect(state.alerts.some((alert) => alert.code === "ai-not-configured")).toBe(true);
  });

  it("stops when the daily LLM budget is spent", async () => {
    const { db, state } = createFakeDb({ ingested: [ingestedFixture()], llmCallsToday: 500 });
    const summary = await runWriteDesk(deps({ db, fetchImpl: aiFetch({}) }), { edition: "midday" });

    expect(summary.metrics.skipped).toBe("llm-budget");
    expect(state.inserts).toHaveLength(0);
    expect(state.alerts.some((alert) => alert.code === "llm-budget-exhausted")).toBe(true);
  });

  it("does nothing (and says so) when the queue is empty", async () => {
    const { db, state } = createFakeDb();
    const summary = await runWriteDesk(deps({ db, fetchImpl: aiFetch({}) }), { edition: "midday" });

    expect(summary.itemsIn).toBe(0);
    expect(state.inserts).toHaveLength(0);
    expect(summary.metrics.note).toBe("queue empty");
  });

  it("skips a story that is a duplicate of something already published", async () => {
    const { db, state } = createFakeDb({
      ingested: [ingestedFixture()],
      posts: [
        scheduledPostFixture({
          status: "published",
          published_at: minutesAgo(240),
          title: "Energy regulator reports 12% rise in wholesale prices",
          content: "Wholesale energy prices rose 12% in March, adding around 180 pounds to a typical annual bill.",
          scheduled_for: null,
        }),
      ],
    });

    const summary = await runWriteDesk(deps({ db, fetchImpl: aiFetch({}) }), { edition: "midday" });

    expect(state.inserts).toHaveLength(0);
    expect(state.ingested[0].status).toBe("rejected");
    expect(state.ingested[0].reject_reason).toContain("duplicate");
    expect(summary.metrics.rejected).toBe(1);
    expect(state.alerts.some((alert) => alert.code === "story-skipped-duplicate")).toBe(true);
  });

  it("returns a failing candidate to the queue, then gives up after three tries", async () => {
    const { db, state } = createFakeDb({ ingested: [ingestedFixture({ attempts: 0 })] });
    // 401 is not retryable: exercises the give-up path without waiting on backoff.
    const failingAi = vi.fn(async () => new Response("upstream down", { status: 401 })) as unknown as typeof fetch;

    await runWriteDesk(deps({ db, fetchImpl: failingAi }), { edition: "midday" });
    expect(state.ingested[0].status).toBe("new");
    expect(state.ingested[0].attempts).toBe(1);

    // Third failure exhausts the retry budget.
    await runWriteDesk(deps({ db, fetchImpl: failingAi }), { edition: "midday" });
    await runWriteDesk(deps({ db, fetchImpl: failingAi }), { edition: "midday" });
    expect(state.ingested[0].status).toBe("rejected");
    expect(state.ingested[0].reject_reason).toBe("processing-error");
    expect(state.alerts.some((alert) => alert.code === "candidate-failed")).toBe(true);
  });

  it("produces a publishable article from a fenced response too", async () => {
    const { db, state } = createFakeDb({
      ingested: [
        ingestedFixture({
          title: "Central bank holds benchmark rate for a third meeting",
          snippet:
            "Policymakers left the benchmark rate unchanged for a third straight meeting, citing cooling inflation and a resilient labour market, and saver rates were left unchanged.",
          category_slug: "business",
        }),
      ],
    });

    await runWriteDesk(deps({ db, fetchImpl: aiFetch({ writer: WRITER_FENCED.response }) }), { edition: "morning" });

    expect(state.inserts).toHaveLength(1);
    expect(["scheduled", "review"]).toContain(state.inserts[0].status);
  });
});

/* -------------------------------------------------------------------------- */
/* Scheduler                                                                  */
/* -------------------------------------------------------------------------- */

describe("activation smoke test (write then publish by hand)", () => {
  // Mirrors the ordered dry run in docs/OPERATIONS.md / the activation
  // checklist: write exactly one story, confirm nothing goes live on its own,
  // then force that one story due and confirm the scheduler releases exactly
  // one - no burst, no cap breach, nothing left published by accident.
  it("does not publish a freshly written story, then releases exactly one when it is due", async () => {
    const { db, state } = createFakeDb({ ingested: [ingestedFixture()], llmCallsToday: 0 });

    const wrote = await runWriteDesk(deps({ db, fetchImpl: aiFetch({}) }), { edition: "midday", limit: 1 });
    expect(wrote.itemsOut).toBe(1);
    const written = state.inserts[0];
    expect(written.status).toBe("scheduled");
    expect(state.posts.filter((post) => post.status === "published")).toHaveLength(0);

    // The scheduler is a no-op until the planned slot arrives.
    const early = await runPublishScheduler(deps({ db }));
    expect(early.itemsOut).toBe(0);
    expect(early.metrics.due).toBe(0);
    expect(state.posts.filter((post) => post.status === "published")).toHaveLength(0);

    // Operator gesture: pull that one story forward (the checklist's SQL).
    const row = state.posts.find((post) => post.slug === written.slug)!;
    row.scheduled_for = new Date(NOW.getTime() - 60_000).toISOString();

    const released = await runPublishScheduler(deps({ db, now: new Date(NOW.getTime() + 60_000) }));
    expect(released.itemsOut).toBe(1);
    expect(released.metrics.slugs).toEqual([written.slug]);
    const published = state.posts.filter((post) => post.status === "published");
    expect(published).toHaveLength(1);
    expect(published[0].published_by).toBe("automation");
    expect(published[0].published_at).toBeTruthy();

    // And it stays at one: a second run has nothing left to release.
    const again = await runPublishScheduler(deps({ db, now: new Date(NOW.getTime() + 120_000) }));
    expect(again.itemsOut).toBe(0);
  });
});

describe("publish-scheduler", () => {
  it("publishes due stories and respects the per-run burst limit", async () => {
    const due = [
      scheduledPostFixture({ id: "p1", slug: "a", category_slug: "world" }),
      scheduledPostFixture({ id: "p2", slug: "b", category_slug: "business" }),
      scheduledPostFixture({ id: "p3", slug: "c", category_slug: "technology" }),
    ];
    const { db, state } = createFakeDb({ posts: due });

    const summary = await runPublishScheduler(deps({ db }));

    expect(summary.itemsOut).toBe(2); // maxBurstPerRun
    const published = state.posts.filter((post) => post.status === "published");
    expect(published).toHaveLength(2);
    expect(published.every((post) => post.published_by === "automation")).toBe(true);
    expect(published.every((post) => post.published_at)).toBe(true);
    // The third story is re-timed, not dropped.
    const held = state.posts.find((post) => post.id === "p3");
    expect(held?.status).toBe("scheduled");
    expect(Date.parse(String(held?.scheduled_for))).toBeGreaterThan(Date.now());
  });

  it("respects the minimum gap between publications", async () => {
    const { db, state } = createFakeDb({
      posts: [
        scheduledPostFixture({ id: "p1", slug: "a" }),
        scheduledPostFixture({
          id: "p0",
          slug: "just-published",
          status: "published",
          published_at: minutesAgo(5),
        }),
      ],
    });

    const summary = await runPublishScheduler(deps({ db }));

    expect(summary.itemsOut).toBe(0);
    expect(summary.metrics.deferred).toBe(1);
    expect(state.posts.find((post) => post.id === "p1")?.status).toBe("scheduled");
  });

  it("stops for the day once the daily cap is reached", async () => {
    const posts = [
      scheduledPostFixture({ id: "p1", slug: "a" }),
      ...Array.from({ length: 18 }, (_, index) =>
        scheduledPostFixture({
          id: `done-${index}`,
          slug: `done-${index}`,
          status: "published",
          published_at: minutesAgo(60),
        }),
      ),
    ];
    const { db, state } = createFakeDb({ posts });

    const summary = await runPublishScheduler(deps({ db }));

    expect(summary.itemsOut).toBe(0);
    expect(summary.metrics.catch_up).toBe("daily cap reached");
    expect(state.posts.find((post) => post.id === "p1")?.status).toBe("scheduled");
  });

  it("does nothing when nothing is due", async () => {
    const { db } = createFakeDb({ posts: [scheduledPostFixture({ scheduled_for: "2030-01-01T00:00:00Z" })] });
    const summary = await runPublishScheduler(deps({ db }));
    expect(summary.metrics.note).toBe("nothing due");
  });

  it("alerts when publishing itself fails", async () => {
    const { db, state } = createFakeDb({ posts: [scheduledPostFixture({ id: "p1" })] });
    db.listScheduledDue = async () => {
      throw new Error("connection reset");
    };

    const summary = await runPublishScheduler(deps({ db }));

    expect(summary.ok).toBe(false);
    expect(state.alerts.some((alert) => alert.code === "publish-failed")).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Trend watch                                                                */
/* -------------------------------------------------------------------------- */

const TRENDS_XML = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item>
    <title>energy price cap</title>
    <ht:approx_traffic>200,000+</ht:approx_traffic>
    <pubDate>Fri, 16 Oct 2026 10:00:00 GMT</pubDate>
    <ht:news_item_title>Regulator confirms energy price cap rise</ht:news_item_title>
  </item>
  <item>
    <title>streaming service price rise</title>
    <ht:approx_traffic>20,000+</ht:approx_traffic>
    <pubDate>Fri, 16 Oct 2026 09:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

describe("trend-watch", () => {
  it("stores scored topics, boosts matching candidates and reports gaps", async () => {
    const { db, state } = createFakeDb({
      ingested: [
        ingestedFixture({ id: "c1", title: "Energy price cap rise confirmed by the regulator", category_slug: "business" }),
      ],
    });
    const fetchImpl = vi.fn(async () => new Response(TRENDS_XML, { status: 200 })) as unknown as typeof fetch;

    const summary = await runTrendWatch(deps({ db, fetchImpl }));

    expect(summary.ok).toBe(true);
    expect(state.trends).toHaveLength(2);
    expect(state.trends[0].score).toBeGreaterThan(state.trends[1].score);
    // The energy topic matches the queued candidate → priority boost.
    expect(state.ingested[0].trend_score).toBeGreaterThan(0);
    expect(summary.metrics.boosted).toBeGreaterThanOrEqual(1);
    // The streaming topic has nothing queued → gap recorded.
    expect(summary.metrics.gaps).toBeGreaterThanOrEqual(1);
    expect(state.alerts.some((alert) => alert.code === "content-gaps")).toBe(true);
  });

  it("does not repeat a topic that has already been covered today", async () => {
    const { db, state } = createFakeDb({
      posts: [
        scheduledPostFixture({
          status: "published",
          published_at: minutesAgo(120),
          scheduled_for: null,
          title: "Energy price cap rise confirmed by regulator",
        }),
      ],
    });
    const fetchImpl = vi.fn(async () => new Response(TRENDS_XML, { status: 200 })) as unknown as typeof fetch;

    const summary = await runTrendWatch(deps({ db, fetchImpl }));

    expect(state.trends).toHaveLength(2); // stored for context
    const insights = summary.metrics.insights as Array<{ topic: string; kind: string }>;
    // The covered topic is dropped; the uncovered one stays a gap.
    expect(insights.some((insight) => insight.topic.includes("energy price cap"))).toBe(false);
    expect(insights.filter((insight) => insight.kind === "gap")).toHaveLength(1);
  });

  it("survives a trends outage", async () => {
    const { db, state } = createFakeDb();
    const fetchImpl = vi.fn(async () => {
      throw new Error("dns failure");
    }) as unknown as typeof fetch;

    const summary = await runTrendWatch(deps({ db, fetchImpl }));

    expect(summary.ok).toBe(false);
    expect(summary.errors[0]).toContain("dns failure");
    expect(state.trends).toHaveLength(0);
  });

  it("loads live trends for the ingest run", async () => {
    const { db } = createFakeDb({
      trends: [
        { topic: "energy price cap", topic_key: "energy price cap", category_slug: "business", score: 62, source: "google-trends", evidence: {} },
      ],
    });
    const trends = await loadLiveTrends(deps({ db }));
    expect(trends).toHaveLength(1);
    expect(trends[0].score).toBe(62);
  });
});

/* -------------------------------------------------------------------------- */
/* Maintenance                                                                */
/* -------------------------------------------------------------------------- */

describe("newsroom-maintenance", () => {
  const oldPost = scheduledPostFixture({
    id: "old",
    slug: "old-story",
    status: "published",
    scheduled_for: null,
    published_at: new Date(NOW.getTime() - 800 * 86_400_000).toISOString(),
    featured_image_url: null,
    content: "An archived story body with no internal links and no image.",
    views: 2,
  });
  const freshPost = scheduledPostFixture({
    id: "fresh",
    slug: "fresh-story",
    status: "published",
    scheduled_for: null,
    published_at: new Date(NOW.getTime() - 3 * 86_400_000).toISOString(),
    featured_image_url: "https://images.example.com/lead.jpg",
    content: "A recent story.",
    views: 120,
  });

  it("repairs missing images, archives dead weight and records health", async () => {
    const { db, state } = createFakeDb({ posts: [oldPost, freshPost] });

    const summary = await runMaintenance(deps({ db, fetchImpl: aiFetch({}) }), { offline: true });

    const repaired = state.posts.find((post) => post.id === "fresh");
    expect(repaired?.featured_image_url).toContain("images.example.com");
    const archived = state.posts.find((post) => post.id === "old");
    expect(archived?.status).toBe("archived");
    expect(state.health).toHaveLength(1);
    expect(state.health[0].kind).toBe("maintenance-sweep");
    expect(summary.metrics.auto_fixed).toEqual({ images: 1, archived: 1 });
  });

  it("gives a story without an image a deterministic replacement", async () => {
    const { db, state } = createFakeDb({
      posts: [
        scheduledPostFixture({
          id: "img",
          slug: "no-image",
          status: "published",
          published_at: minutesAgo(120),
          featured_image_url: null,
          content: "body",
        }),
      ],
    });

    await runMaintenance(deps({ db }), { offline: true });

    const post = state.posts.find((entry) => entry.id === "img");
    expect(post?.featured_image_url).toContain("picsum.photos/seed/no-image");
  });

  it("flags outbound links that no longer answer", async () => {
    const withLinks = scheduledPostFixture({
      id: "links",
      slug: "link-story",
      status: "published",
      scheduled_for: null,
      published_at: minutesAgo(120),
      featured_image_url: "https://images.example.com/x.jpg",
      content: "See [the report](https://dead.example.com/report) for the figures behind this story.",
      views: 40,
    });
    const { db, state } = createFakeDb({ posts: [withLinks] });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("dead.example.com")) return new Response("gone", { status: 404 });
      return new Response("<urlset></urlset>", { status: 200 });
    }) as unknown as typeof fetch;

    const summary = await runMaintenance(deps({ db, fetchImpl }));

    const linksChecked = summary.metrics.counts as { links_checked: number };
    expect(linksChecked.links_checked).toBeGreaterThanOrEqual(1);
    const findings = summary.metrics.sample as Array<{ kind: string }>;
    expect(findings.some((finding) => finding.kind === "broken-link")).toBe(true);
    expect(state.health).toHaveLength(1);
  });

  it("reports stale public endpoints as critical", async () => {
    const { db, state } = createFakeDb({ posts: [freshPost] });
    const fetchImpl = vi.fn(async () => new Response("down", { status: 500 })) as unknown as typeof fetch;

    await runMaintenance(deps({ db, fetchImpl }));

    expect(state.health[0].ok).toBe(false);
    expect(state.alerts.some((alert) => alert.code === "maintenance-critical")).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Monitor                                                                    */
/* -------------------------------------------------------------------------- */

describe("phase6-monitor", () => {
  it("escalates when nothing has been published for too long", async () => {
    const { db, state } = createFakeDb({
      status: {
        posts: { published_24h: 0, scheduled: 0, review: 3, last_published_at: "2026-10-14T00:00:00Z" },
        candidates: { new: 0 },
        sources: { active: 0 },
        alerts: { critical_open: 1 },
        pipeline: { failures_24h: 4 },
        llm: { calls_today: 0 },
        trends: { live: 0 },
      },
    });

    const summary = await runMonitor(deps({ db }));

    expect(summary.ok).toBe(false);
    const problems = summary.metrics.problems as string[];
    expect(problems.join(" ")).toContain("no publication");
    expect(problems.join(" ")).toContain("queue empty");
    expect(problems.join(" ")).toContain("no active sources");
    const codes = state.alerts.map((alert) => alert.code);
    expect(codes).toEqual(expect.arrayContaining(["publishing-stalled", "queue-empty", "sources-exhausted"]));
    expect(state.alerts.find((alert) => alert.code === "publishing-stalled")?.severity).toBe("critical");
  });

  it("stays quiet when the newsroom is healthy", async () => {
    const { db, state } = createFakeDb({
      status: {
        posts: { published_24h: 9, scheduled: 4, review: 1, last_published_at: minutesAgo(90) },
        candidates: { new: 12 },
        sources: { active: 20, degraded: 1, disabled: 0 },
        alerts: { critical_open: 0 },
        pipeline: { failures_24h: 0 },
        llm: { calls_today: 24 },
        trends: { live: 6 },
      },
    });

    const summary = await runMonitor(deps({ db }));

    expect(summary.ok).toBe(true);
    expect(summary.metrics.autonomous).toBe(true);
    expect(state.alerts).toHaveLength(0);
    expect(summary.metrics.trends_live).toBe(6);
  });
});
