// Trend detection and content-gap analysis.
//
// Trends exist to decide *what to write about*, not to generate spam. The rules:
//   * A trend can only raise the priority of a story the desk was already going
//     to consider — it never creates a candidate on its own.
//   * Trend topics are matched against ingested candidates and against what has
//     already been published today, so a topic that has been covered loses its
//     boost (no "trend spam" repetition).
//   * Scores decay with age and are capped, so one viral topic cannot take over
//     the publishing plan.

import { contentTokens, normalizeWhitespace } from "./text.ts";
import { normalizeHeadline, titleSimilarity } from "./dedupe.ts";
import type { CategorySlug } from "./types.ts";

export interface TrendTopic {
  topic: string;
  topicKey: string;
  categorySlug: CategorySlug | null;
  score: number; // 0..100
  source: string;
  evidence: Record<string, unknown>;
}

export const TREND_LIMITS = {
  /** Google Trends traffic ("20,000+") is bucketed, not a raw count. */
  maxScore: 100,
  /** Trends older than this stop mattering. */
  maxAgeHours: 24,
  /** A topic already covered today is skipped rather than repeated. */
  coverageSimilarity: 0.5,
  /** How many topics a single run may store. */
  maxTopicsPerRun: 40,
  /** Boost applied to a candidate whose subject matches a live trend. */
  candidateBoost: 25,
} as const;

/** Traffic buckets from the Google Trends RSS feed. */
export function parseTraffic(approxTraffic: string | undefined): number {
  if (!approxTraffic) return 0;
  const digits = approxTraffic.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const value = Number(digits);
  if (!Number.isFinite(value)) return 0;
  // Buckets: 200 → 20, 1000 → 32, 10000 → 45, 100000 → 62, 500000 → 78, 1M+ → 92
  if (value >= 1_000_000) return 92;
  return Math.min(TREND_LIMITS.maxScore, Math.round(12 + Math.log10(Math.max(1, value)) * 17));
}

export function topicKeyFor(topic: string): string {
  return normalizeHeadline(topic) || normalizeWhitespace(topic).toLowerCase();
}

export interface TrendFeedItem {
  title: string;
  traffic?: string;
  published?: string;
  relatedTitles?: string[];
}

/**
 * Turn raw trend-feed entries into scored topics.
 * `classify` is injected so this module does not depend on the classifier.
 */
export function buildTrendTopics(
  items: TrendFeedItem[],
  classify: (input: { title: string }) => { slug: string; confidence: number },
  options: { now?: Date; source?: string } = {},
): TrendTopic[] {
  const now = options.now ?? new Date();
  const out: TrendTopic[] = [];

  for (const item of items) {
    const topic = normalizeWhitespace(item.title);
    if (topic.length < 8) continue;

    const ageHours = item.published ? Math.max(0, (now.getTime() - Date.parse(item.published)) / 3_600_000) : 0;
    if (ageHours > TREND_LIMITS.maxAgeHours) continue;

    const freshness = Math.max(0, 1 - ageHours / TREND_LIMITS.maxAgeHours);
    const base = parseTraffic(item.traffic);
    if (base === 0) continue;

    const classified = classify({ title: topic });
    // Trends are noise-prone: only trust the section when the classifier is sure.
    const categorySlug = classified.confidence >= 0.55 ? (classified.slug as CategorySlug) : null;
    const corroboration = Math.min(1, (item.relatedTitles?.length ?? 0) / 4);
    const score = Math.min(
      TREND_LIMITS.maxScore,
      Math.round(base * (0.7 + 0.3 * freshness) + corroboration * 8),
    );

    out.push({
      topic,
      topicKey: topicKeyFor(topic),
      categorySlug,
      score,
      source: options.source ?? "google-trends",
      evidence: {
        traffic: item.traffic ?? null,
        published: item.published ?? null,
        related: (item.relatedTitles ?? []).slice(0, 3),
        confidence: classified.confidence,
      },
    });
  }

  // Keep the strongest topics, and never store more than the cap.
  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, TREND_LIMITS.maxTopicsPerRun);
}

export interface CoverageDecision {
  covered: boolean;
  byTitle?: string;
  similarity?: number;
}

/** Has this topic already been covered (published or scheduled) today? */
export function trendCovered(
  topic: string,
  publishedTitles: string[],
  threshold = TREND_LIMITS.coverageSimilarity,
): CoverageDecision {
  let best = 0;
  let byTitle: string | undefined;
  for (const title of publishedTitles) {
    const similarity = titleSimilarity(topic, title);
    if (similarity > best) {
      best = similarity;
      byTitle = title;
    }
  }
  return { covered: best >= threshold, byTitle, similarity: best ? Number(best.toFixed(3)) : undefined };
}

export interface GapInput {
  trends: TrendTopic[];
  /** Candidates waiting, with the tokens we can match a topic against. */
  candidates: Array<{ id: string; title: string; categorySlug?: string | null; trustTier?: number }>;
  /** Headlines already published or scheduled today. */
  publishedToday: string[];
  /** Categories that are below their share of today's output. */
  underServedCategories?: string[];
}

export interface GapInsight {
  topicKey: string;
  topic: string;
  score: number;
  categorySlug: string | null;
  /** Candidate ids this topic boosts (empty = coverage gap, nothing queued). */
  candidateIds: string[];
  kind: "boost" | "gap";
  note: string;
}

/**
 * Match trends to the candidate queue.
 *   boost → we have something to write, and it is worth doing first
 *   gap   → readers want this and there is nothing queued (a topic instruction
 *           for the next ingest cycle, not permission to invent an article)
 */
export function analyseGaps(input: GapInput): GapInsight[] {
  const insights: GapInsight[] = [];

  // Document frequency across the pool, so generic words ("price", "rise")
  // cannot make two unrelated topics look like the same story.
  const documentFrequency = new Map<string, number>();
  for (const document of [...input.trends.map((trend) => trend.topic), ...input.candidates.map((c) => c.title)]) {
    for (const token of new Set(contentTokens(document))) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const isDistinctive = (token: string) => (documentFrequency.get(token) ?? 1) <= 2;

  for (const trend of input.trends) {
    const covered = trendCovered(trend.topic, input.publishedToday);
    if (covered.covered) continue; // no trend spam

    const tokens = new Set(contentTokens(trend.topic));
    const matches =
      tokens.size < 2
        ? []
        : input.candidates
            .map((candidate) => {
              const candidateTokens = contentTokens(candidate.title);
              if (candidateTokens.length === 0 || tokens.size === 0) return { candidate, overlap: 0, distinctive: 0 };
              const shared = candidateTokens.filter((token) => tokens.has(token));
              const distinctive = shared.filter(isDistinctive).length;
              return {
                candidate,
                overlap: shared.length / Math.min(tokens.size, candidateTokens.length),
                distinctive,
              };
            })
            .filter((match) => match.distinctive >= 2 && match.overlap >= 0.4)
            .sort((a, b) => b.distinctive - a.distinctive || b.overlap - a.overlap)
            .slice(0, 3)
            .map((match) => match.candidate.id);

    if (matches.length > 0) {
      insights.push({
        topicKey: trend.topicKey,
        topic: trend.topic,
        score: trend.score,
        categorySlug: trend.categorySlug,
        candidateIds: matches,
        kind: "boost",
        note: `priority boost for ${matches.length} queued candidate(s)`,
      });
      continue;
    }

    const underServed =
      trend.categorySlug !== null && (input.underServedCategories ?? []).includes(trend.categorySlug);
    insights.push({
      topicKey: trend.topicKey,
      topic: trend.topic,
      score: Math.round(trend.score * (underServed ? 1 : 0.8)),
      categorySlug: trend.categorySlug,
      candidateIds: [],
      kind: "gap",
      note: underServed
        ? `gap in an under-served section: ${trend.categorySlug}`
        : "gap: nothing queued on this topic",
    });
  }

  return insights.sort((a, b) => b.score - a.score);
}

/** Trend score to store on an ingested candidate (used by claim ordering). */
export function trendScoreFor(title: string, topics: TrendTopic[]): number {
  let best = 0;
  for (const topic of topics) {
    const similarity = titleSimilarity(title, topic.topic);
    if (similarity >= 0.4) best = Math.max(best, Math.round(topic.score * similarity));
  }
  return Math.min(TREND_LIMITS.maxScore, best);
}

/** Extract trend entries from a Google Trends RSS document. */
export function parseTrendsXml(xml: string): TrendFeedItem[] {
  const items: TrendFeedItem[] = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);

  for (const block of blocks) {
    const title = pick(block, "title");
    if (!title) continue;
    const traffic = pick(block, "ht:approx_traffic") ?? pick(block, "approx_traffic");
    const published = pick(block, "pubDate");
    const related = [...block.matchAll(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/gi)]
      .map((match) => decode(match[1]))
      .filter((value) => value.length > 0)
      .slice(0, 5);
    items.push({ title, traffic, published, relatedTitles: related });
  }

  return items;
}

function pick(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return undefined;
  const value = decode(match[1]);
  return value.length > 0 ? value : undefined;
}

function decode(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );
}

export const GOOGLE_TRENDS_RSS = "https://trends.google.com/trending/rss?geo=US";
