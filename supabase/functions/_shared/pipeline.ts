// The autonomous newsroom pipeline.
//
// Six entry points, each called by pg_cron and each safe to run twice:
//
//   runIngest()            fetch feeds → validate → dedupe → classify → queue
//   runWriteDesk()         queue → AI rewrite → verify → score → schedule/review
//   runPublishScheduler()  due queue → burst/cap/gap gates → publish
//   runTrendWatch()        trend feeds → scoring → priority boosts + gap notes
//   runMaintenance()       sitemap/feeds, images, links, orphans, stale posts
//   runMonitor()           status snapshot → alerts + heartbeat
//
// Design rules:
//   * Every run returns a summary and records a pipeline_runs row. Failures are
//     local: one bad feed or one bad draft never aborts the run.
//   * Nothing is published without passing safety, plagiarism, duplication and
//     quality gates. Anything uncertain goes to the review queue instead.
//   * Every dependency (db, AI, image providers, fetch, clock) is injected so
//     the whole pipeline can be exercised in tests without a network.

import type { AiConfig, WriterDraft } from "./ai.ts";
import {
  buildAltTextPrompt,
  buildVerifierPrompt,
  buildWriterPrompt,
  SYSTEM_HEADLINE,
  SYSTEM_IMAGE_ALT,
  SYSTEM_VERIFIER,
  SYSTEM_WRITER,
  buildHeadlinePrompt,
  chat,
  parseAltText,
  parseHeadlineAlternatives,
  parseVerifierResponse,
  parseWriterDraft,
  type ChatResult,
} from "./ai.ts";
import { classifyCategory, humanizeCategory } from "./classify.ts";
import {
  dedupeBatch,
  duplicationRisk,
  findDuplicate,
  fingerprint,
  simhash,
  type ComparablePost,
} from "./dedupe.ts";
import type { IngestedRow, NewsroomDb, NewPost, PostRow } from "./db.ts";
import { simhashFromDb, simhashToDb } from "./db.ts";
import { consistencyReport, plagiarismReport, structureReport } from "./facts.ts";
import {
  altTextFor,
  fetchImageCandidates,
  imageQueryFor,
  resolveFeaturedImage,
  type ImageProviderConfig,
} from "./images.ts";
import { evaluateQuality, QUALITY_THRESHOLDS, summarizeQuality } from "./quality.ts";
import { guardedFetch, HttpError } from "./retry.ts";
import { scanSafety, summarizeSafety } from "./safety.ts";
import {
  PUBLISH_LIMITS,
  canPublishNow,
  catchUpPlan,
  editionForHour,
  nextEdition,
  planEditionTimes,
  rescheduleOverdue,
  utcDateString,
  wordTargetFor,
  angleFor,
} from "./schedule.ts";
import { prepareSeoBundle, buildSchemaFields } from "./seo.ts";
import type { Edition, RejectedItem } from "./types.ts";
import { filterFeedItems, parseFeedXml, sourceHealthDecision } from "./sources.ts";
import { wordCount } from "./text.ts";
import {
  GOOGLE_TRENDS_RSS,
  analyseGaps,
  buildTrendTopics,
  parseTrendsXml,
  trendScoreFor,
  type TrendTopic,
} from "./trends.ts";
import {
  MAINTENANCE_RULES,
  checkEndpoints,
  findBrokenImages,
  findInconsistentNumbers,
  findOrphans,
  findStalePosts,
  planLinkChecks,
  summariseFindings,
  type EndpointSnapshot,
  type MaintenanceFinding,
} from "./maintenance.ts";

export interface PipelineDeps {
  db: NewsroomDb;
  /** null when no AI key is configured — the desk then defers instead of inventing. */
  ai: AiConfig | null;
  images?: ImageProviderConfig;
  fetchImpl?: typeof fetch;
  now?: Date;
  /** Public site base URL, used by the maintenance sweep. */
  siteUrl?: string;
  budget?: {
    maxLlmCallsPerDay?: number;
    maxPostsPerRun?: number;
    maxCandidatesPerRun?: number;
  };
  log?: (event: string, data?: Record<string, unknown>) => void;
}

export interface RunSummary {
  function: string;
  ok: boolean;
  itemsIn: number;
  itemsOut: number;
  llmCalls: number;
  durationMs: number;
  metrics: Record<string, unknown>;
  errors: string[];
}

const DEFAULT_BUDGET = {
  /** Caps daily spend; the AI quota is the most expensive dependency we have. */
  maxLlmCallsPerDay: 220,
  maxPostsPerRun: 4,
  maxCandidatesPerRun: 24,
} as const;

/** Desk bylines, matching src/lib/authors.ts (asserted by src/test/site.test.ts). */
export const DESK_BY_CATEGORY: Record<string, string> = {
  "breaking-news": "NewsSparkle Editorial Desk",
  world: "NewsSparkle Editorial Desk",
  politics: "Politics & Policy Desk",
  business: "Business & Markets Desk",
  technology: "Technology & AI Desk",
  health: "Health & Lifestyle Desk",
  entertainment: "Entertainment & Culture Desk",
  sports: "NewsSparkle Editorial Desk",
};

function log(deps: PipelineDeps, event: string, data?: Record<string, unknown>): void {
  deps.log?.(event, data);
}

function summarise(
  name: string,
  startedAt: number,
  partial: Partial<Omit<RunSummary, "function" | "durationMs">> = {},
): RunSummary {
  return {
    function: name,
    ok: partial.ok ?? true,
    itemsIn: partial.itemsIn ?? 0,
    itemsOut: partial.itemsOut ?? 0,
    llmCalls: partial.llmCalls ?? 0,
    metrics: partial.metrics ?? {},
    errors: partial.errors ?? [],
    durationMs: Date.now() - startedAt,
  };
}

/** Record the run, tolerating telemetry failures (they must never break news). */
async function finishRun(deps: PipelineDeps, summary: RunSummary, edition?: Edition | null): Promise<RunSummary> {
  try {
    await deps.db.recordPipelineRun({
      function: summary.function,
      edition: edition ?? null,
      ok: summary.ok,
      items_in: summary.itemsIn,
      items_out: summary.itemsOut,
      llm_calls: summary.llmCalls,
      duration_ms: summary.durationMs,
      metrics: summary.metrics,
      error: summary.errors.length > 0 ? summary.errors.slice(0, 4).join(" | ").slice(0, 900) : null,
    });
  } catch (error) {
    log(deps, "pipeline_run_write_failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return summary;
}

/* -------------------------------------------------------------------------- */
/* 1. Ingest                                                                  */
/* -------------------------------------------------------------------------- */

export interface IngestOptions {
  /** Cap the fan-out per run (a fresh deploy should not hammer 24 feeds at once). */
  maxSources?: number;
  maxItemsPerSource?: number;
  /** Trend topics to score candidates against — fetched by trend-watch. */
  trends?: TrendTopic[];
}

export async function runIngest(deps: PipelineDeps, options: IngestOptions = {}): Promise<RunSummary> {
  const startedAt = Date.now();
  const now = deps.now ?? new Date();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const errors: string[] = [];

  const sources = (await deps.db.listActiveSources()).filter(
    (source) => !source.disabled_until || Date.parse(source.disabled_until) <= now.getTime(),
  );
  const selected = sources.slice(0, options.maxSources ?? sources.length);
  const maxItemsPerSource = options.maxItemsPerSource ?? 12;

  const accepted: IngestedRow[] = [];
  const rejected: RejectedItem[] = [];
  let fetched = 0;
  let healthy = 0;
  let failing = 0;

  for (const source of selected) {
    try {
      const response = await guardedFetch(source.url, {
        fetchImpl,
        attempts: 2,
        timeoutMs: 15_000,
        headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
      });
      if (!response.ok) throw new HttpError(response.status, source.url, "");

      const xml = await response.text();
      const parsed = parseFeedXml(xml, {
        name: source.name,
        trustTier: (source.trust_tier as 1 | 2 | 3) ?? 2,
        categoryHint: source.category_slug,
      });
      fetched += parsed.items.length;

      const { accepted: valid, rejected: invalid } = filterFeedItems(parsed.items, {
        now,
        maxItems: maxItemsPerSource,
      });
      rejected.push(...invalid.map((item) => ({ ...item, reason: `${source.name}: ${item.reason}` })));

      for (const item of valid) {
        const classification = classifyCategory({ title: item.title, snippet: item.snippet, sourceHint: item.categoryHint });
        const trendScore = options.trends?.length ? trendScoreFor(item.title, options.trends) : 0;
        const row: IngestedRow = {
          id: "",
          fingerprint: fingerprint(item.title),
          simhash: simhashToDb(simhash(`${item.title} ${item.snippet ?? ""}`)),
          title: item.title,
          url: item.url ?? null,
          snippet: item.snippet ?? null,
          source_id: source.id,
          source_name: source.name,
          trust_tier: item.trustTier ?? source.trust_tier,
          corroboration: 1,
          corroborating: [],
          category_slug: classification.slug,
          published_at: item.published ?? null,
          trend_score: trendScore,
          status: "new",
          attempts: 0,
        };
        accepted.push(row);
      }

      await deps.db.markSourceSuccess(source.id, parsed.items.length, now);
      healthy++;
    } catch (error) {
      failing++;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${source.name}: ${message.slice(0, 160)}`);
      const consecutive = (source.consecutive_failures ?? 0) + 1;
      const decision = sourceHealthDecision(consecutive);
      const disabledUntil = decision.disable
        ? new Date(now.getTime() + decision.cooldownHours * 3_600_000).toISOString()
        : null;
      try {
        await deps.db.markSourceFailure(source.id, {
          error: message.slice(0, 300),
          consecutiveFailures: consecutive,
          disabledUntil,
          at: now,
        });
      } catch (dbError) {
        log(deps, "source_health_write_failed", { source: source.name, error: String(dbError) });
      }
      if (decision.disable) {
        await deps.db.recordAlert({
          code: "feed-disabled",
          severity: "warning",
          subject: source.name,
          message: `${source.name} parked for ${decision.cooldownHours}h after ${consecutive} failures: ${message.slice(0, 200)}`,
          context: { url: source.url, cooldownHours: decision.cooldownHours },
        });
      }
    }
  }

  // Cross-source de-duplication: the same story from several wires becomes one
  // candidate with corroboration, which is what makes "two sources agree" cheap.
  const tiered = accepted.map((row) => ({
    title: row.title,
    trustTier: row.trust_tier,
    row,
  }));
  const { kept, dropped } = dedupeBatch(tiered);
  const corroboratingByTitle = new Map<string, { sources: Set<string>; tiers: number[] }>();
  for (const droppedItem of dropped) {
    const survivor = kept.find((entry) => entry.title === droppedItem.duplicateOf) ?? kept[0];
    if (!survivor) continue;
    const bucket = corroboratingByTitle.get(survivor.title) ?? { sources: new Set<string>(), tiers: [] };
    bucket.sources.add(droppedItem.item.row.source_name);
    bucket.tiers.push(droppedItem.item.trustTier);
    corroboratingByTitle.set(survivor.title, bucket);
  }

  const payload = kept.map((entry) => {
    const corroboration = (corroboratingByTitle.get(entry.title)?.sources.size ?? 0) + 1;
    const corroborating = [...(corroboratingByTitle.get(entry.title)?.sources ?? [])];
    return {
      fingerprint: entry.row.fingerprint,
      simhash: entry.row.simhash === null || entry.row.simhash === undefined ? null : String(entry.row.simhash),
      title: entry.row.title,
      url: entry.row.url,
      snippet: entry.row.snippet,
      source_id: entry.row.source_id,
      source_name: entry.row.source_name,
      trust_tier: entry.row.trust_tier,
      category_slug: entry.row.category_slug,
      published_at: entry.row.published_at,
      trend_score: Number(entry.row.trend_score),
      corroboration,
      corroborating,
    };
  });

  let inserted = 0;
  try {
    inserted = await deps.db.insertIngestedItems(payload);
    // Existing rows (same fingerprint on a previous run) gain corroboration.
    const existing = await deps.db.findIngestedByFingerprints(payload.map((row) => row.fingerprint));
    for (const row of existing) {
      const incoming = payload.find((candidate) => candidate.fingerprint === row.fingerprint);
      if (!incoming) continue;
      const sources = new Set<string>([
        ...((row.corroborating as string[] | undefined) ?? []),
        incoming.source_name,
      ]);
      const corroboration = Math.max(row.corroboration, sources.size);
      if (corroboration > row.corroboration || sources.size !== ((row.corroborating as unknown[]) ?? []).length) {
        await deps.db.bumpCorroboration(row.id, [...sources], corroboration);
      }
    }
  } catch (error) {
    errors.push(`insert: ${error instanceof Error ? error.message : String(error)}`);
  }

  const summary = summarise("ingest-feeds", startedAt, {
    ok: errors.length === 0 || inserted > 0 || healthy > 0,
    itemsIn: fetched,
    itemsOut: inserted,
    errors,
    metrics: {
      sources_checked: selected.length,
      sources_healthy: healthy,
      sources_failing: failing,
      rejected: rejected.length,
      rejected_sample: rejected.slice(0, 12),
      deduped: dropped.length,
      pending: await safeCount(deps),
    },
  });
  log(deps, "ingest_complete", { inserted, fetched, failing, rejected: rejected.length });
  return finishRun(deps, summary);
}

async function safeCount(deps: PipelineDeps): Promise<number> {
  try {
    return await deps.db.countNewCandidates();
  } catch {
    return -1;
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Write desk                                                              */
/* -------------------------------------------------------------------------- */

export interface WriteDeskOptions {
  edition?: Edition;
  limit?: number;
  categories?: string[];
}

interface PreparedDraft {
  draft: WriterDraft;
  chatResult: ChatResult | null;
}

export async function runWriteDesk(deps: PipelineDeps, options: WriteDeskOptions = {}): Promise<RunSummary> {
  const startedAt = Date.now();
  const now = deps.now ?? new Date();
  const edition = options.edition ?? editionForHour(now.getUTCHours()) ?? nextEdition(now.getUTCHours());
  const targetWords = wordTargetFor(edition);
  const budget = { ...DEFAULT_BUDGET, ...(deps.budget ?? {}) };
  const errors: string[] = [];
  const llmBudgetNote: string[] = [];

  if (!deps.ai) {
    await deps.db.recordAlert({
      code: "ai-not-configured",
      severity: "critical",
      subject: "write-desk",
      message: "No AI key configured: the desk cannot write. Publishing is paused, nothing is invented.",
    });
    return finishRun(
      deps,
      summarise("write-desk", startedAt, {
        ok: false,
        errors: ["ai-not-configured"],
        metrics: { edition, skipped: true },
      }),
      edition,
    );
  }

  try {
    const used = await deps.db.llmCallsToday();
    if (used >= budget.maxLlmCallsPerDay) {
      await deps.db.recordAlert({
        code: "llm-budget-exhausted",
        severity: "warning",
        subject: "write-desk",
        message: `Daily LLM budget consumed (${used}/${budget.maxLlmCallsPerDay}); the desk stops until tomorrow.`,
        context: { used, limit: budget.maxLlmCallsPerDay },
      });
      return finishRun(
        deps,
        summarise("write-desk", startedAt, {
          ok: true,
          metrics: { edition, skipped: "llm-budget", used },
        }),
        edition,
      );
    }
  } catch (error) {
    errors.push(`budget check: ${error instanceof Error ? error.message : String(error)}`);
  }

  const limit = Math.min(options.limit ?? budget.maxPostsPerRun, budget.maxPostsPerRun);
  let claimed: IngestedRow[] = [];
  try {
    claimed = await deps.db.claimIngested(Math.max(limit, 1));
  } catch (error) {
    errors.push(`claim: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (claimed.length === 0) {
    return finishRun(
      deps,
      summarise("write-desk", startedAt, { metrics: { edition, candidates: 0, note: "queue empty" } }),
      edition,
    );
  }

  const recentPosts = await loadRecentPosts(deps, { days: 7, limit: 80 });
  const publishedToday = recentPosts.today;
  const recentComparable: ComparablePost[] = recentPosts.rows.map((post) => ({
    title: post.title,
    slug: post.slug,
    hash: simhashFromDb(post.simhash) ?? undefined,
    content: post.content ?? undefined,
  }));

  let written = 0;
  let scheduled = 0;
  let review = 0;
  let rejected = 0;
  let llmCalls = 0;
  const plannedSlots: Date[] = [];
  const plannedCategories: string[] = [];
  const details: Array<Record<string, unknown>> = [];

  if (options.categories?.length) {
    // A category-scoped run releases everything else straight back to the queue
    // instead of leaving it stranded in "processing".
    const wanted: IngestedRow[] = [];
    for (const item of claimed) {
      if (!item.category_slug || options.categories.includes(item.category_slug)) {
        wanted.push(item);
        continue;
      }
      try {
        await deps.db.updateIngested(item.id, { status: "new", processed_at: null });
      } catch (error) {
        log(deps, "candidate_release_failed", { id: item.id, error: String(error) });
      }
    }
    claimed = wanted;
  }

  for (const candidate of claimed) {
    const itemStarted = Date.now();
    try {
      const classification = classifyCategory({
        title: candidate.title,
        snippet: candidate.snippet,
        sourceHint: candidate.category_slug,
      });

      const writerPrompt = buildWriterPrompt({
        edition,
        category: humanizeCategory(classification.slug),
        angle: angleFor(edition),
        targetWords,
        sources: [
          {
            title: candidate.title,
            url: candidate.url ?? undefined,
            snippet: candidate.snippet ?? undefined,
            published: candidate.published_at ?? undefined,
            sourceName: candidate.source_name,
            trustTier: (candidate.trust_tier as 1 | 2 | 3) ?? 2,
            categoryHint: classification.slug,
          },
        ],
        titleHint: candidate.title,
        avoidHeadlines: publishedToday.slice(0, 12).map((post) => post.title),
      });

      const written0 = await chat(deps.ai, {
        system: SYSTEM_WRITER,
        user: writerPrompt,
        maxTokens: 2_600,
        fetchImpl: deps.fetchImpl,
      });
      llmCalls++;
      const draft = parseWriterDraft(written0.text);
      if (!draft) {
        await markCandidate(deps, candidate, "rejected", "unparseable-model-output");
        rejected++;
        continue;
      }

      const prepared: PreparedDraft = { draft, chatResult: written0 };
      const dedupeVerdict = findDuplicate(
        { title: prepared.draft.title, content: prepared.draft.content },
        recentComparable,
      );
      const risk = duplicationRisk(dedupeVerdict);
      if (dedupeVerdict.severity === "duplicate") {
        await markCandidate(deps, candidate, "rejected", `duplicate:${dedupeVerdict.reason}`);
        await deps.db.recordAlert({
          code: "story-skipped-duplicate",
          severity: "info",
          subject: candidate.title.slice(0, 80),
          message: `Skipped a rewrite of a published story (${dedupeVerdict.reason}).`,
          context: { matched: dedupeVerdict.matchedTitle ?? null, similarity: dedupeVerdict.titleSimilarity ?? null },
        });
        rejected++;
        continue;
      }

      const { bundle, validation: seoValidation } = prepareSeoBundle(
        {
          title: prepared.draft.title,
          excerpt: prepared.draft.excerpt,
          content: prepared.draft.content,
          metaTitle: prepared.draft.metaTitle,
          metaDescription: prepared.draft.metaDescription,
          keywords: prepared.draft.keywords,
        },
        {
          brand: "NewsSparkle",
          takenSlugs: recentComparable.map((post) => post.slug).filter((slug): slug is string => Boolean(slug)),
        },
      );

      const sourceRef = {
        title: candidate.title,
        url: candidate.url,
        source: candidate.source_name,
        trustTier: candidate.trust_tier,
      };

      // Verification pass: the model checks its own draft against the sources.
      const verification = await chat(deps.ai, {
        fetchImpl: deps.fetchImpl,
        system: SYSTEM_VERIFIER,
        user: buildVerifierPrompt(prepared.draft.content, [
          {
            title: candidate.title,
            snippet: candidate.snippet ?? undefined,
            published: candidate.published_at ?? undefined,
            sourceName: candidate.source_name,
            trustTier: (candidate.trust_tier as 1 | 2 | 3) ?? 2,
          },
        ]),
        maxTokens: 700,
        temperature: 0.1,
      });
      llmCalls++;
      const verdict = parseVerifierResponse(verification.text);

      const safety = scanSafety(`${prepared.draft.title}\n\n${prepared.draft.content}`);
      const plagiarism = plagiarismReport(prepared.draft.content, [
        { title: candidate.title, snippet: candidate.snippet ?? undefined, sourceName: candidate.source_name, trustTier: 2 },
      ]);
      const structure = structureReport(prepared.draft.content, {
        minWords: Math.round(targetWords * 0.6),
        minH2: 2,
        minH3: 1,
        minParagraphs: 4,
      });
      const consistency = consistencyReport({
        draft: prepared.draft.content,
        sources: [
          { title: candidate.title, snippet: candidate.snippet ?? undefined, sourceName: candidate.source_name, trustTier: 2 },
        ],
        modelSupported: verdict.supported,
        modelConfidence: verdict.confidence,
      });

      const evaluation = evaluateQuality({
        title: prepared.draft.title,
        excerpt: prepared.draft.excerpt,
        content: prepared.draft.content,
        metaTitle: bundle.metaTitle,
        metaDescription: bundle.metaDescription,
        keywords: bundle.keywords,
        faq: prepared.draft.faq,
        keyTakeaways: prepared.draft.keyTakeaways,
        targetWords,
        sources: [
          { title: candidate.title, snippet: candidate.snippet ?? undefined, sourceName: candidate.source_name, trustTier: 2 },
        ],
        classification,
        safety,
        structure,
        grounding: consistency.grounding,
        plagiarism,
        duplicationRisk: risk,
        verification: { modelSupported: verdict.supported, modelConfidence: verdict.confidence, modelNotes: verdict.notes },
      });

      // Headline alternatives are only fetched for drafts that are otherwise good.
      let title = prepared.draft.title;
      if (evaluation.report.verdict !== "reject" && seoValidation.issues.length > 0) {
        try {
          const headlines = await chat(deps.ai, {
            fetchImpl: deps.fetchImpl,
            system: SYSTEM_HEADLINE,
            user: buildHeadlinePrompt(prepared.draft.content, humanizeCategory(classification.slug), publishedToday.map((p) => p.title)),
            maxTokens: 300,
            temperature: 0.4,
          });
          llmCalls++;
          const alternatives = parseHeadlineAlternatives(headlines.text, title);
          const better = alternatives.find((option) => option.length >= 30 && option.length <= 110);
          if (better) title = better;
        } catch (error) {
          log(deps, "headline_pass_failed", { error: error instanceof Error ? error.message : String(error) });
        }
      }

      const slug = bundle.slug;
      const image = await resolveImage(deps, {
        slug,
        title,
        category: classification.slug,
        query: imageQueryFor(title, classification.slug),
        generatedAlt: await generateAltText(deps, { title, category: classification.slug, costTick: () => llmCalls++ }),
      });

      const status = evaluation.report.verdict === "publish" ? "scheduled" : evaluation.report.verdict === "review" ? "review" : "rejected";
      const scheduledFor = status === "scheduled" ? nextSlot(plannedSlots, now, edition) : null;

      const post: NewPost = {
        title,
        slug,
        excerpt: bundle.excerpt,
        content: prepared.draft.content,
        meta_title: bundle.metaTitle,
        meta_description: bundle.metaDescription,
        keywords: bundle.keywords,
        key_takeaways: prepared.draft.keyTakeaways ?? [],
        faq: prepared.draft.faq ?? [],
        category_slug: classification.slug,
        author: DESK_BY_CATEGORY[classification.slug] ?? DESK_BY_CATEGORY.world,
        status,
        reading_minutes: Math.max(1, Math.round(wordCount(prepared.draft.content) / 225)),
        published_at: null,
        scheduled_for: scheduledFor?.toISOString() ?? null,
        featured_image_url: image.url,
        featured_image_alt: image.alt,
        image_credit: image.credit,
        image_credit_url: image.creditUrl,
        quality_score: Math.round(evaluation.report.score),
        quality_report: {
          ...evaluation.report,
          verification: { supported: verdict.supported, confidence: verdict.confidence, notes: verdict.notes },
          schema: buildSchemaFields({
            title,
            description: bundle.metaDescription,
            category: classification.slug,
            keywords: bundle.keywords,
            imageUrl: image.url,
            imageAlt: image.alt,
          }),
        },
        dedupe_fingerprint: fingerprint(title),
        simhash: simhashToDb(simhash(prepared.draft.content)),
        word_count: wordCount(prepared.draft.content),
        review_reason:
          status === "review"
            ? [...evaluation.report.warnings, ...evaluation.report.blockingReasons].slice(0, 5).join("; ")
            : status === "rejected"
              ? evaluation.report.blockingReasons.slice(0, 5).join("; ")
              : null,
        published_by: "automation",
        ai_model: written0.model,
        source_refs: [sourceRef],
        source_category: candidate.category_slug,
      };

      const inserted = await deps.db.insertPost(post);
      if (status === "scheduled") {
        plannedSlots.push(scheduledFor as Date);
        plannedCategories.push(classification.slug);
        scheduled++;
      } else if (status === "review") {
        review++;
        await deps.db.recordAlert({
          code: "post-needs-review",
          severity: "warning",
          subject: slug,
          message: `Draft held for review: ${post.review_reason ?? "quality below publish bar"}`,
          context: { score: evaluation.report.score, verdict: evaluation.report.verdict },
        });
      } else {
        rejected++;
      }

      written++;
      await markCandidate(deps, candidate, status === "rejected" ? "rejected" : "used", status === "rejected" ? "quality-gate" : null);

      details.push({
        slug,
        category: classification.slug,
        status,
        score: evaluation.report.score,
        words: post.word_count,
        quality: summarizeQuality(evaluation.report),
        safety: summarizeSafety(safety),
        duplicates: dedupeVerdict.reason,
        ms: Date.now() - itemStarted,
      });
      log(deps, "draft_complete", { slug, status, score: evaluation.report.score });
      void inserted;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate.title.slice(0, 60)}: ${message.slice(0, 200)}`);
      // claim_ingested_items() already incremented attempts for this run.
      const attempt = Math.max(1, candidate.attempts ?? 1);
      const retryable = attempt < 3;
      try {
        await deps.db.updateIngested(candidate.id, {
          status: retryable ? "new" : "rejected",
          attempts: attempt,
          last_error: message.slice(0, 300),
          next_attempt_at: retryable ? new Date(now.getTime() + attempt * 20 * 60_000).toISOString() : null,
          reject_reason: retryable ? null : "processing-error",
        });
      } catch (dbError) {
        log(deps, "candidate_update_failed", { id: candidate.id, error: String(dbError) });
      }
      if (!retryable) {
        await deps.db.recordAlert({
          code: "candidate-failed",
          severity: "warning",
          subject: candidate.title.slice(0, 80),
          message: `Dropped a candidate after ${attempt} attempts: ${message.slice(0, 200)}`,
        });
      }
    }
  }

  if (review > 0) llmBudgetNote.push(`${review} draft(s) awaiting review`);

  const summary = summarise("write-desk", startedAt, {
    ok: errors.length === 0 || written > 0,
    itemsIn: claimed.length,
    itemsOut: written,
    llmCalls,
    errors,
    metrics: {
      edition,
      created: written,
      scheduled,
      review,
      rejected,
      category_mix: plannedCategories.reduce<Record<string, number>>((acc, slug) => {
        acc[slug] = (acc[slug] ?? 0) + 1;
        return acc;
      }, {}),
      notes: llmBudgetNote,
      details,
      thresholds: QUALITY_THRESHOLDS,
    },
  });
  return finishRun(deps, summary, edition);
}

async function markCandidate(
  deps: PipelineDeps,
  candidate: IngestedRow,
  status: "used" | "rejected",
  reason: string | null,
): Promise<void> {
  try {
    await deps.db.updateIngested(candidate.id, {
      status,
      reject_reason: reason,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    log(deps, "candidate_update_failed", { id: candidate.id, error: String(error) });
  }
}

/** Recent published/scheduled posts, plus today's headlines for anti-repetition. */
async function loadRecentPosts(
  deps: PipelineDeps,
  options: { days: number; limit: number },
): Promise<{ rows: PostRow[]; today: PostRow[] }> {
  const rows = await deps.db.listPosts({
    statuses: ["published", "scheduled"],
    withinDays: options.days,
    limit: options.limit,
    includeContent: true,
  });
  const startOfDay = new Date(deps.now ?? new Date());
  startOfDay.setUTCHours(0, 0, 0, 0);
  const today = rows.filter((post) => {
    const stamp = post.published_at ?? post.scheduled_for;
    return stamp ? Date.parse(stamp) >= startOfDay.getTime() : false;
  });
  return { rows, today };
}

/** Pick the next free publishing slot after the last planned one. */
function nextSlot(planned: Date[], now: Date, edition: Edition): Date {
  const gapMs = PUBLISH_LIMITS.minGapMinutes * 60_000;
  const latest = planned.length > 0 ? planned[planned.length - 1] : null;
  const base = latest ? latest.getTime() + gapMs : now.getTime() + gapMs;
  const earliest = Math.max(base, now.getTime() + gapMs);

  const slots = planEditionTimes({ edition, count: 8, date: utcDateString(now) });
  const free = slots.find((slot) => slot.at.getTime() >= earliest)
    ?? slots.find((slot) => slot.at.getTime() >= now.getTime() + gapMs);
  if (free) {
    const candidate = new Date(Math.max(free.at.getTime(), earliest));
    const maxLookahead = now.getTime() + PUBLISH_LIMITS.maxLookaheadHours * 3_600_000;
    return candidate.getTime() > maxLookahead ? new Date(earliest) : candidate;
  }
  return new Date(earliest);
}

async function generateAltText(
  deps: PipelineDeps,
  input: { title: string; category: string | null; costTick: () => void },
): Promise<string | null> {
  if (!deps.ai) return null;
  try {
    const result = await chat(deps.ai, {
      fetchImpl: deps.fetchImpl,
      system: SYSTEM_IMAGE_ALT,
      user: buildAltTextPrompt(input.title, input.category ?? "news"),
      maxTokens: 120,
      temperature: 0.3,
    });
    input.costTick();
    return parseAltText(result.text, altTextFor({ title: input.title, category: input.category }));
  } catch {
    return altTextFor({ title: input.title, category: input.category });
  }
}

async function resolveImage(
  deps: PipelineDeps,
  input: { slug: string; title: string; category: string | null; query: string; generatedAlt: string | null },
) {
  const providers = deps.images ?? {};
  let candidates: Awaited<ReturnType<typeof fetchImageCandidates>> = [];
  try {
    candidates = await fetchImageCandidates(input.query, providers, { fetchImpl: deps.fetchImpl });
  } catch (error) {
    log(deps, "image_providers_failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return resolveFeaturedImage({
    slug: input.slug,
    title: input.title,
    category: input.category,
    candidates,
    generatedAlt: input.generatedAlt,
  });
}

/* -------------------------------------------------------------------------- */
/* 3. Publish scheduler                                                       */
/* -------------------------------------------------------------------------- */

export interface SchedulerOptions {
  /** Hard ceiling per run; the burst limit inside canPublishNow still applies. */
  limit?: number;
  /** When true, overdue posts are re-timed instead of dumped. */
  rebalanceOverdue?: boolean;
}

export async function runPublishScheduler(deps: PipelineDeps, options: SchedulerOptions = {}): Promise<RunSummary> {
  const startedAt = Date.now();
  const now = deps.now ?? new Date();
  const errors: string[] = [];
  const budget = { ...DEFAULT_BUDGET, ...(deps.budget ?? {}) };
  const limit = options.limit ?? budget.maxPostsPerRun;

  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  let published = 0;
  let deferred = 0;
  const publishedSlugs: string[] = [];

  try {
    const due = await deps.db.listScheduledDue(now, limit);
    if (due.length === 0) {
      return finishRun(
        deps,
        summarise("publish-scheduler", startedAt, { metrics: { due: 0, note: "nothing due" } }),
      );
    }

    const publishedToday = await deps.db.countPublishedSince(startOfDay);
    const categoryCounts = await deps.db.publishedTodayByCategory(startOfDay);
    const lastPublishedAt = await deps.db.lastPublishedAt();
    const plan = catchUpPlan({ now, overdue: due.length, publishedToday });

    if (plan.publish === 0) {
      // Daily ceiling reached: re-time everything into the next window rather
      // than publishing a burst or dropping the stories.
      const tomorrow = new Date(now.getTime() + 86_400_000);
      const rescheduled = rescheduleOverdue({ now: tomorrow, overdueCount: due.length });
      for (let i = 0; i < due.length; i++) {
        await deps.db.updatePost(due[i].id, { scheduled_for: rescheduled[i].toISOString() });
      }
      return finishRun(
        deps,
        summarise("publish-scheduler", startedAt, {
          ok: true,
          itemsIn: due.length,
          metrics: { due: due.length, published: 0, deferred: due.length, catch_up: plan.note, published_today: publishedToday },
        }),
      );
    }

    let thisRun = 0;
    for (const post of due) {
      if (thisRun >= plan.publish) {
        const [next] = rescheduleOverdue({ now, overdueCount: thisRun + 1 });
        await deps.db.updatePost(post.id, { scheduled_for: next.toISOString() });
        deferred++;
        continue;
      }
      const gate = canPublishNow({
        now,
        lastPublishedAt,
        publishedToday: publishedToday + thisRun,
        category: post.category_slug ?? "world",
        categoryPublishedToday: (categoryCounts[post.category_slug ?? "world"] ?? 0) + thisRun,
        publishedThisRun: thisRun,
      });

      if (!gate.allowed) {
        if (gate.reason === "min-gap" || gate.reason === "burst-limit") {
          deferred++;
          if (options.rebalanceOverdue !== false) {
            const [next] = rescheduleOverdue({ now, overdueCount: 1 });
            await deps.db.updatePost(post.id, { scheduled_for: next.toISOString() });
          }
        } else {
          // Daily or category cap: hold the post for tomorrow's first window.
          const tomorrow = new Date(now.getTime() + 86_400_000);
          await deps.db.updatePost(post.id, {
            scheduled_for: nextSlot([], tomorrow, "morning").toISOString(),
          });
          deferred++;
        }
        continue;
      }

      await deps.db.updatePost(post.id, {
        status: "published",
        published_at: now.toISOString(),
        published_by: "automation",
      });
      published++;
      thisRun++;
      publishedSlugs.push(post.slug);
      log(deps, "published", { slug: post.slug, category: post.category_slug });
    }

    if (plan.publish === 0 && due.length > 0 && published === 0) deferred = due.length;

    const summary = summarise("publish-scheduler", startedAt, {
      ok: errors.length === 0,
      itemsIn: due.length,
      itemsOut: published,
      errors,
      metrics: {
        due: due.length,
        published,
        deferred,
        published_today: publishedToday + published,
        daily_cap: PUBLISH_LIMITS.maxPerDay,
        catch_up: plan.note,
        slugs: publishedSlugs,
      },
    });
    return finishRun(deps, summary);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    await deps.db.recordAlert({
      code: "publish-failed",
      severity: "critical",
      subject: "publish-scheduler",
      message: `Publishing failed: ${errors[0].slice(0, 200)}`,
    });
    return finishRun(deps, summarise("publish-scheduler", startedAt, { ok: false, errors }));
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Trend watch                                                             */
/* -------------------------------------------------------------------------- */

export interface TrendWatchOptions {
  feeds?: string[];
  maxTopics?: number;
}

export async function runTrendWatch(deps: PipelineDeps, options: TrendWatchOptions = {}): Promise<RunSummary> {
  const startedAt = Date.now();
  const now = deps.now ?? new Date();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const errors: string[] = [];
  const feeds = options.feeds ?? [GOOGLE_TRENDS_RSS];

  const topics: TrendTopic[] = [];
  for (const feed of feeds) {
    try {
      const response = await guardedFetch(feed, { fetchImpl, attempts: 2, timeoutMs: 12_000 });
      if (!response.ok) throw new HttpError(response.status, feed, "");
      const parsed = parseTrendsXml(await response.text());
      topics.push(
        ...buildTrendTopics(parsed, (input) => classifyCategory({ title: input.title }), { now, source: "google-trends" }),
      );
    } catch (error) {
      errors.push(`${feed}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let stored = 0;
  if (topics.length > 0) {
    try {
      stored = await deps.db.upsertTrends(
        topics.slice(0, options.maxTopics ?? topics.length).map((topic) => ({
          topic: topic.topic,
          topic_key: topic.topicKey,
          category_slug: topic.categorySlug,
          score: topic.score,
          source: topic.source,
          evidence: topic.evidence,
        })),
      );
    } catch (error) {
      errors.push(`store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const today = await deps.db.listPosts({ statuses: ["published", "scheduled"], withinDays: 1, limit: 40 });
  const publishedToday = today
    .filter((post) => {
      const stamp = post.published_at ?? post.scheduled_for;
      return stamp ? Date.parse(stamp) >= startOfDay.getTime() : false;
    })
    .map((post) => post.title);

  const candidates = await safeQueueSnapshot(deps);
  const underServed = Object.entries(await deps.db.publishedTodayByCategory(startOfDay))
    .filter(([, count]) => count > 0)
    .map(([slug]) => slug);

  const insights = analyseGaps({
    trends: topics,
    candidates,
    publishedToday,
    underServedCategories: [
      "world",
      "politics",
      "business",
      "technology",
      "health",
      "entertainment",
      "sports",
      "breaking-news",
    ].filter((slug) => !underServed.includes(slug)),
  });

  // Boost queued candidates that match a live trend.
  let boosted = 0;
  for (const insight of insights) {
    if (insight.kind !== "boost") continue;
    for (const id of insight.candidateIds) {
      try {
        await deps.db.updateIngested(id, { trend_score: insight.score });
        boosted++;
      } catch (error) {
        log(deps, "trend_boost_failed", { id, error: String(error) });
      }
    }
  }

  const gaps = insights.filter((insight) => insight.kind === "gap");
  if (gaps.length > 0) {
    await deps.db.recordAlert({
      code: "content-gaps",
      severity: "info",
      subject: "trend-watch",
      message: `${gaps.length} trending topic(s) with nothing queued: ${gaps
        .slice(0, 3)
        .map((gap) => gap.topic)
        .join(", ")}`,
      context: { gaps: gaps.slice(0, 8).map((gap) => ({ topic: gap.topic, category: gap.categorySlug, score: gap.score })) },
    });
  }

  const summary = summarise("trend-watch", startedAt, {
    ok: errors.length === 0 || topics.length > 0,
    itemsIn: topics.length,
    itemsOut: stored,
    errors,
    metrics: {
      topics: topics.length,
      stored,
      boosted,
      gaps: gaps.length,
      covered: topics.length - insights.length,
      top: topics.slice(0, 5).map((topic) => ({ topic: topic.topic, score: topic.score, category: topic.categorySlug })),
      insights: insights.slice(0, 10),
    },
  });
  return finishRun(deps, summary);
}

async function safeQueueSnapshot(
  deps: PipelineDeps,
): Promise<Array<{ id: string; title: string; categorySlug?: string | null; trustTier?: number }>> {
  try {
    const rows = await deps.db.listQueuedCandidates(200);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      categorySlug: row.category_slug,
      trustTier: row.trust_tier,
    }));
  } catch {
    return [];
  }
}

/** Trend topics currently live — used by the ingest run to prioritise matches. */
export async function loadLiveTrends(deps: PipelineDeps, limit = 40): Promise<TrendTopic[]> {
  try {
    const rows = await deps.db.listLiveTrends(limit);
    return rows.map((row) => ({
      topic: row.topic,
      topicKey: row.topic_key,
      categorySlug: (row.category_slug as TrendTopic["categorySlug"]) ?? null,
      score: Number(row.score),
      source: row.source,
      evidence: row.evidence,
    }));
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Maintenance                                                             */
/* -------------------------------------------------------------------------- */

export interface MaintenanceOptions {
  /** Public endpoints to check. Defaults to this site's own feeds. */
  endpoints?: Array<{ name: string; url: string }>;
  /** Skip network checks (used by the monitor and by tests). */
  offline?: boolean;
}

export async function runMaintenance(deps: PipelineDeps, options: MaintenanceOptions = {}): Promise<RunSummary> {
  const startedAt = Date.now();
  const now = deps.now ?? new Date();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const siteUrl = (deps.siteUrl ?? "").replace(/\/$/, "");
  const findings: MaintenanceFinding[] = [];
  const counts: Record<string, unknown> = {};

  // --- published corpus snapshot -------------------------------------------
  const posts = await deps.db.listPosts({ statuses: ["published"], limit: 200, includeContent: false });
  counts.published_sampled = posts.length;

  // A content sample is needed for link, orphan and padding checks: without the
  // bodies every story would look like an orphan.
  const contentSample = await deps.db.listPosts({ statuses: ["published"], limit: 60, includeContent: true });
  counts.bodies_sampled = contentSample.length;

  const images = findBrokenImages(
    posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      featured_image_url: post.featured_image_url ?? null,
    })),
  );
  findings.push(...images);
  let imagesFixed = 0;
  for (const finding of images.filter((item) => item.autoFixable)) {
    const slug = finding.subject;
    const post = posts.find((entry) => entry.slug === slug);
    if (!post) continue;
    try {
      const candidates = options.offline
        ? []
        : await fetchImageCandidates(imageQueryFor(post.title, post.category_slug), deps.images ?? {}, { fetchImpl });
      const resolved = resolveFeaturedImage({
        slug,
        title: post.title,
        category: post.category_slug,
        candidates,
      });
      await deps.db.updatePost(post.id, {
        featured_image_url: resolved.url,
        featured_image_alt: resolved.alt,
        image_credit: resolved.credit,
        image_credit_url: resolved.creditUrl,
      });
      imagesFixed++;
    } catch (error) {
      log(deps, "image_repair_failed", { slug, error: String(error) });
    }
  }

  findings.push(...findStalePosts(
    posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      published_at: post.published_at,
      views: post.views ?? 0,
      word_count: post.word_count ?? null,
    })),
    now,
  ));
  let archived = 0;
  for (const finding of findings.filter((item) => item.kind === "stale-post" && item.autoFixable)) {
    const id = finding.context?.id as string | undefined;
    if (!id) continue;
    try {
      await deps.db.updatePost(id, { status: "archived", archived_at: now.toISOString() });
      archived++;
    } catch (error) {
      log(deps, "archive_failed", { id, error: String(error) });
    }
  }

  // --- outbound links -------------------------------------------------------
  if (!options.offline && siteUrl) {
    const plan = planLinkChecks(
      contentSample.map((post) => ({ slug: post.slug, content: post.content ?? "" })),
      { skipDomains: [new URL(siteUrl).hostname, "localhost", "127.0.0.1"] },
    );
    for (const check of plan) {
      let ok = true;
      try {
        const response = await guardedFetch(check.url, { fetchImpl, attempts: 1, timeoutMs: 8_000 });
        ok = response.ok || response.status === 405;
      } catch {
        ok = false;
      }
      if (!ok) {
        findings.push({
          kind: "broken-link",
          severity: "warning",
          subject: check.slug,
          detail: `outbound link does not respond: ${check.url}`,
          autoFixable: false,
          context: { url: check.url },
        });
      }
    }
    counts.links_checked = plan.length;
  }

  // --- orphans + internal linking ------------------------------------------
  const linkedSlugs = new Set<string>();
  for (const post of contentSample) {
    const slug = post.slug;
    const referenced = contentSample.some(
      (other) => other.slug !== slug && (other.content ?? "").includes(`/${slug}`),
    );
    if (referenced) linkedSlugs.add(slug);
  }
  const orphans = findOrphans(
    posts.map((post) => ({
      slug: post.slug,
      title: post.title,
      category_slug: post.category_slug,
      published_at: post.published_at,
    })),
    [...linkedSlugs],
    { now, limit: 20 },
  );
  findings.push(...orphans);
  counts.orphans = orphans.length;

  findings.push(...findInconsistentNumbers(
    contentSample.map((post) => ({ slug: post.slug, title: post.title, content: post.content ?? "" })),
  ));

  // --- public endpoints -----------------------------------------------------
  if (!options.offline && siteUrl) {
    const endpoints = options.endpoints ?? [
      { name: "sitemap", url: `${siteUrl}/sitemap.xml` },
      { name: "news-sitemap", url: `${siteUrl}/news-sitemap.xml` },
      { name: "rss", url: `${siteUrl}/rss.xml` },
    ];
    const snapshots: EndpointSnapshot[] = [];
    for (const endpoint of endpoints) {
      let ok = false;
      let itemCount: number | undefined;
      try {
        const response = await guardedFetch(endpoint.url, { fetchImpl, attempts: 1, timeoutMs: 10_000 });
        ok = response.ok;
        if (ok) {
          const body = await response.text();
          itemCount = (body.match(/<(?:url|item|entry)[\s>]/g) ?? []).length;
        }
      } catch {
        ok = false;
      }
      snapshots.push({ name: endpoint.name, url: endpoint.url, checkedAt: now.toISOString(), ok, itemCount });
    }
    findings.push(...checkEndpoints(snapshots, now));
    counts.endpoints = snapshots.map((snapshot) => ({ name: snapshot.name, ok: snapshot.ok, items: snapshot.itemCount ?? null }));
  }

  const verdict = summariseFindings(findings);
  await deps.db.recordHealthCheck({
    kind: "maintenance-sweep",
    ok: verdict.ok,
    checked: posts.length,
    findings: findings.slice(0, 100),
    counts: { ...counts, by_kind: verdict.byKind, auto_fixed: { images: imagesFixed, archived } },
    duration_ms: Date.now() - startedAt,
  });

  if (verdict.critical > 0) {
    await deps.db.recordAlert({
      code: "maintenance-critical",
      severity: "critical",
      subject: "maintenance",
      message: `${verdict.critical} critical housekeeping finding(s): ${verdict.worstSubjects.slice(0, 3).join(", ")}`,
      context: { by_kind: verdict.byKind },
    });
  }

  const summary = summarise("newsroom-maintenance", startedAt, {
    ok: verdict.ok,
    itemsIn: posts.length,
    itemsOut: imagesFixed + archived,
    metrics: {
      findings: findings.length,
      by_kind: verdict.byKind,
      auto_fixed: { images: imagesFixed, archived },
      worst: verdict.worstSubjects,
      counts,
      sample: findings.slice(0, 10),
      rules: MAINTENANCE_RULES,
    },
  });
  return finishRun(deps, summary);
}

/* -------------------------------------------------------------------------- */
/* 6. Monitor                                                                 */
/* -------------------------------------------------------------------------- */

export interface MonitorOptions {
  /** Hours without a publication before the monitor escalates. */
  stalePublishingHours?: number;
}

export async function runMonitor(deps: PipelineDeps, options: MonitorOptions = {}): Promise<RunSummary> {
  const startedAt = Date.now();
  const errors: string[] = [];
  const staleHours = options.stalePublishingHours ?? 12;

  let status: Record<string, unknown> = {};
  try {
    status = await deps.db.newsroomStatus();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const posts = (status.posts ?? {}) as Record<string, unknown>;
  const candidates = (status.candidates ?? {}) as Record<string, unknown>;
  const sources = (status.sources ?? {}) as Record<string, unknown>;
  const alerts = (status.alerts ?? {}) as Record<string, unknown>;
  const pipeline = (status.pipeline ?? {}) as Record<string, unknown>;
  const llm = (status.llm ?? {}) as Record<string, unknown>;
  const trends = (status.trends ?? {}) as Record<string, unknown>;

  const now = deps.now ?? new Date();
  const lastPublished = typeof posts.last_published_at === "string" ? posts.last_published_at : null;
  const hoursSincePublish = lastPublished ? (now.getTime() - Date.parse(lastPublished)) / 3_600_000 : null;

  const problems: string[] = [];
  if (hoursSincePublish !== null && hoursSincePublish > staleHours) {
    problems.push(`no publication in ${Math.round(hoursSincePublish)}h`);
    await deps.db.recordAlert({
      code: "publishing-stalled",
      severity: "critical",
      subject: "monitor",
      message: `Nothing published for ${Math.round(hoursSincePublish)}h. Check candidates, budget and gates.`,
      context: { hoursSincePublish: Math.round(hoursSincePublish), candidates },
    });
  }
  if (Number(candidates.new ?? 0) === 0 && Number(posts.scheduled ?? 0) === 0) {
    problems.push("candidate queue empty and nothing scheduled");
    await deps.db.recordAlert({
      code: "queue-empty",
      severity: "warning",
      subject: "monitor",
      message: "No candidates waiting and no scheduled posts: the desk will publish nothing next run.",
      context: { sources },
    });
  }
  if (Number(sources.active ?? 0) === 0) {
    problems.push("no active sources");
    await deps.db.recordAlert({
      code: "sources-exhausted",
      severity: "critical",
      subject: "monitor",
      message: "Every feed is disabled or failing. Ingest cannot recover without operator input.",
      context: { sources },
    });
  }
  if (Number(pipeline.failures_24h ?? 0) >= 3) {
    problems.push(`${pipeline.failures_24h} pipeline failures in 24h`);
  }
  if (Number(alerts.critical_open ?? 0) > 0) {
    problems.push(`${alerts.critical_open} open critical alert(s)`);
  }
  if (Number(llm.calls_today ?? 0) === 0 && Number(candidates.new ?? 0) > 0) {
    problems.push("candidates waiting but no AI calls made today");
  }

  const summary = summarise("phase6-monitor", startedAt, {
    ok: problems.length === 0,
    itemsIn: Number(candidates.new ?? 0),
    itemsOut: Number(posts.published_24h ?? 0),
    errors,
    metrics: {
      status,
      problems,
      hours_since_publish: hoursSincePublish === null ? null : Number(hoursSincePublish.toFixed(1)),
      autonomous: problems.length === 0,
      trends_live: Number(trends.live ?? 0),
    },
  });
  return finishRun(deps, summary);
}

/** Exposed for the monitor UI/summary: is the newsroom healthy enough to be left alone? */
export function autonomyVerdict(summary: RunSummary, thresholds: { minPublished24h?: number } = {}): {
  level: string;
  ok: boolean;
  notes: string[];
} {
  const published = Number((summary.metrics as { status?: { posts?: { published_24h?: number } } }).status?.posts?.published_24h ?? 0);
  const min = thresholds.minPublished24h ?? 6;
  const notes: string[] = [];
  let level = "high";
  if (published < min) {
    notes.push(`only ${published} posts in 24h`);
    level = "medium";
  }
  if (summary.errors.length > 0) {
    notes.push(`${summary.errors.length} monitor error(s)`);
    level = "low";
  }
  return { level, ok: summary.ok, notes };
}
