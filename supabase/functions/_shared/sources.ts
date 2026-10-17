// Feed ingestion: parsing, validation and source-health policy.
//
// Nothing from an external feed is trusted. Every item is parsed defensively,
// then must pass validation (length, language, spam bait, timeliness, URL
// shape) before it can become a candidate. Rejections are recorded with a
// reason so operators can see which feeds are noisy.

import { decodeEntities, looksEnglish, normalizeWhitespace, stripHtml } from "./text.ts";
import { isClickbait } from "./safety.ts";
import type { RejectedItem, SourceFeedItem } from "./types.ts";

export const FEED_LIMITS = {
  /** Below this, a headline carries no usable facts. */
  minTitleLength: 22,
  /** Above this, the "title" is a paragraph or a botched parse. */
  maxTitleLength: 220,
  minSnippetLength: 40,
  maxSnippetLength: 1_500,
  /** Wire copy older than this is stale for a daily newsroom. */
  maxAgeHours: 36,
  /** Tolerate small clock skew between publishers. */
  futureToleranceMinutes: 240,
  maxItemsPerSource: 12,
} as const;

export interface FeedSourceDescriptor {
  name: string;
  trustTier?: 1 | 2 | 3;
  categoryHint?: string | null;
}

export interface FeedParseResult {
  items: SourceFeedItem[];
  format: "rss" | "atom" | "unknown";
}

/** Extract `<tag>…</tag>` including CDATA bodies. */
function extractTag(block: string, tag: string): string | undefined {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const match = block.match(pattern);
  if (!match) return undefined;
  const value = stripHtml(match[1]);
  return value.length > 0 ? value : undefined;
}

/** Atom links are attributes: `<link rel="alternate" href="…"/>`. */
function extractAtomLink(block: string): string | undefined {
  const alternate = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (alternate) return alternate[1].trim();
  const anyLink = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (anyLink) return anyLink[1].trim();
  return extractTag(block, "link");
}

function extractBlocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(pattern)].map((m) => m[1]);
}

/** Parse RSS 2.0 or Atom into normalised feed items. Never throws. */
export function parseFeedXml(xml: string, source: FeedSourceDescriptor): FeedParseResult {
  if (typeof xml !== "string" || xml.trim().length === 0) {
    return { items: [], format: "unknown" };
  }

  const rssBlocks = extractBlocks(xml, "item");
  const atomBlocks = rssBlocks.length > 0 ? [] : extractBlocks(xml, "entry");
  const blocks = rssBlocks.length > 0 ? rssBlocks : atomBlocks;
  const format: FeedParseResult["format"] =
    rssBlocks.length > 0 ? "rss" : atomBlocks.length > 0 ? "atom" : "unknown";

  const items: SourceFeedItem[] = [];
  for (const block of blocks) {
    const rawTitle = extractTag(block, "title") ?? "";
    const title = normalizeWhitespace(decodeEntities(rawTitle)).replace(/\s+[-–—]\s+$/, "");
    if (!title) continue;

    const snippetRaw =
      extractTag(block, "description") ??
      extractTag(block, "summary") ??
      extractTag(block, "content:encoded") ??
      extractTag(block, "content") ??
      "";

    const published =
      extractTag(block, "pubDate") ??
      extractTag(block, "published") ??
      extractTag(block, "updated") ??
      extractTag(block, "dc:date");

    const url =
      (rssBlocks.length > 0 ? extractTag(block, "link") : extractAtomLink(block)) ??
      extractTag(block, "guid") ??
      undefined;

    items.push({
      title: title.slice(0, FEED_LIMITS.maxTitleLength),
      url: url?.startsWith("http") ? url : undefined,
      snippet: snippetRaw ? normalizeWhitespace(snippetRaw).slice(0, FEED_LIMITS.maxSnippetLength) : undefined,
      published,
      sourceName: source.name,
      trustTier: source.trustTier ?? 2,
      categoryHint: source.categoryHint ?? null,
    });
  }

  return { items, format };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export interface FeedItemValidation {
  ok: boolean;
  reason?: string;
  /** Items that are usable but imperfect (kept, flagged). */
  warnings?: string[];
}

/** Feed furniture: section pages, newsletters and podcasts are not stories. */
const FURNITURE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:subscribe|newsletter|sign up|follow us)\b/i, "promotional"],
  [/^\s*(?:podcast|video|live blog|live updates?)\s*:/i, "non-article-format"],
  [/\b(?:horoscopes?|crossword|weather forecast|tv listings?|lottery results?)\b/i, "non-news-furniture"],
  [/\b(?:sponsored|advertorial|press release|paid post)\b/i, "sponsored"],
  [/\b(?:photos?|gallery):\s/i, "gallery-only"],
  [/\|\s*(?:latest news|breaking news|home)\s*$/i, "section-page"],
];

export function isStalePublished(
  published: string | undefined,
  now: Date,
  maxAgeHours = FEED_LIMITS.maxAgeHours,
): boolean {
  if (!published) return false; // undated items are kept and flagged instead
  const time = Date.parse(published);
  if (Number.isNaN(time)) return false;
  return now.getTime() - time > maxAgeHours * 3_600_000;
}

export function isFutureDated(
  published: string | undefined,
  now: Date,
  toleranceMinutes = FEED_LIMITS.futureToleranceMinutes,
): boolean {
  if (!published) return false;
  const time = Date.parse(published);
  if (Number.isNaN(time)) return false;
  return time - now.getTime() > toleranceMinutes * 60_000;
}

export function validateFeedItem(
  item: SourceFeedItem,
  options: { now?: Date; requireSnippet?: boolean } = {},
): FeedItemValidation {
  const now = options.now ?? new Date();
  const title = normalizeWhitespace(item.title);
  const warnings: string[] = [];

  if (title.length < FEED_LIMITS.minTitleLength) return { ok: false, reason: "title-too-short" };
  if (title.length > FEED_LIMITS.maxTitleLength) return { ok: false, reason: "title-too-long" };
  if (/\b(?:untitled|no title|null|undefined)\b/i.test(title)) return { ok: false, reason: "placeholder-title" };

  for (const [pattern, reason] of FURNITURE_PATTERNS) {
    if (pattern.test(title)) return { ok: false, reason };
  }
  if (isClickbait(title)) return { ok: false, reason: "clickbait" };

  // SHOUTED HEADLINES: compare capitals against letters rather than using a
  // regex, because /^[A-Z\s]+$/i matches ordinary sentence-case titles too.
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 12) {
    const capitals = (title.match(/[A-Z]/g) ?? []).length;
    if (capitals / letters.length > 0.7) return { ok: false, reason: "shouting-headline" };
  }

  const snippet = normalizeWhitespace(item.snippet ?? "");
  if (snippet.length > 0) {
    if (snippet.length < FEED_LIMITS.minSnippetLength) warnings.push("thin-snippet");
  } else if (options.requireSnippet !== false && title.length < FEED_LIMITS.minTitleLength + 20) {
    return { ok: false, reason: "no-usable-text" };
  }

  if (!looksEnglish(`${title} ${snippet}`)) return { ok: false, reason: "non-english" };

  if (item.url && !/^https?:\/\//i.test(item.url)) return { ok: false, reason: "invalid-url" };
  if (item.url && /\/(?:tag|tags|category|categories|author|authors)\//i.test(item.url)) {
    return { ok: false, reason: "listing-page-url" };
  }

  if (isStalePublished(item.published, now)) return { ok: false, reason: "stale" };
  if (isFutureDated(item.published, now)) return { ok: false, reason: "future-dated" };
  if (!item.published || Number.isNaN(Date.parse(item.published))) warnings.push("undated");

  return { ok: true, warnings: warnings.length > 0 ? warnings : undefined };
}

export interface FilterOptions {
  now?: Date;
  maxItems?: number;
  requireSnippet?: boolean;
}

export interface FilterResult {
  accepted: SourceFeedItem[];
  rejected: RejectedItem[];
}

/** Validate a batch, keeping the freshest items and capping the volume. */
export function filterFeedItems(items: SourceFeedItem[], options: FilterOptions = {}): FilterResult {
  const now = options.now ?? new Date();
  const maxItems = options.maxItems ?? FEED_LIMITS.maxItemsPerSource;
  const accepted: SourceFeedItem[] = [];
  const rejected: RejectedItem[] = [];
  const seenUrls = new Set<string>();

  for (const item of items) {
    const verdict = validateFeedItem(item, { now, requireSnippet: options.requireSnippet });
    if (!verdict.ok) {
      rejected.push({ title: item.title.slice(0, 120), reason: verdict.reason ?? "invalid" });
      continue;
    }
    if (item.url) {
      const key = item.url.split("?")[0];
      if (seenUrls.has(key)) {
        rejected.push({ title: item.title.slice(0, 120), reason: "duplicate-url" });
        continue;
      }
      seenUrls.add(key);
    }
    accepted.push(item);
  }

  accepted.sort((a, b) => {
    const at = a.published ? Date.parse(a.published) : 0;
    const bt = b.published ? Date.parse(b.published) : 0;
    return bt - at;
  });

  return {
    accepted: accepted.slice(0, maxItems),
    rejected: [
      ...rejected,
      ...accepted.slice(maxItems).map((item) => ({ title: item.title.slice(0, 120), reason: "over-batch-limit" })),
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Source health                                                              */
/* -------------------------------------------------------------------------- */

export const SOURCE_HEALTH = {
  /** Consecutive failures before a feed is parked. */
  failureThreshold: 3,
  baseCooldownHours: 6,
  maxCooldownHours: 72,
} as const;

export interface HealthDecision {
  disable: boolean;
  cooldownHours: number;
  reason?: string;
}

/**
 * Exponential cooldown so a permanently dead feed stops consuming the ingest
 * budget, while a feed that recovers is retried automatically.
 */
export function sourceHealthDecision(
  consecutiveFailures: number,
  options: { threshold?: number; baseCooldownHours?: number; maxCooldownHours?: number } = {},
): HealthDecision {
  const threshold = options.threshold ?? SOURCE_HEALTH.failureThreshold;
  const base = options.baseCooldownHours ?? SOURCE_HEALTH.baseCooldownHours;
  const max = options.maxCooldownHours ?? SOURCE_HEALTH.maxCooldownHours;

  if (consecutiveFailures < threshold) return { disable: false, cooldownHours: 0 };

  const cooldownHours = Math.min(max, base * Math.pow(2, consecutiveFailures - threshold));
  return {
    disable: true,
    cooldownHours,
    reason: `${consecutiveFailures} consecutive failures — parked for ${cooldownHours}h`,
  };
}

export function cooldownUntil(now: Date, cooldownHours: number): Date {
  return new Date(now.getTime() + cooldownHours * 3_600_000);
}

/** Weight used when several sources cover the same story. */
export function trustWeight(trustTier: number | undefined): number {
  switch (trustTier) {
    case 1:
      return 1.0;
    case 2:
      return 0.7;
    case 3:
      return 0.45;
    default:
      return 0.6;
  }
}

/** Priority score for the candidate queue: trust, corroboration, freshness. */
export function candidatePriority(input: {
  trustTier?: number;
  corroboration?: number;
  published?: string | null;
  trendScore?: number;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  const ageHours = input.published
    ? Math.max(0, (now.getTime() - Date.parse(input.published)) / 3_600_000)
    : 12;
  const freshness = Math.max(0, 1 - ageHours / FEED_LIMITS.maxAgeHours);
  const corroboration = Math.min(1, ((input.corroboration ?? 1) - 1) / 3);

  return Number(
    (
      trustWeight(input.trustTier) * 0.45 +
      freshness * 0.3 +
      corroboration * 0.15 +
      Math.min(1, (input.trendScore ?? 0) / 100) * 0.1
    ).toFixed(4),
  );
}

/** Display label for a feed URL, used when a source row lacks a name. */
export function sourceLabelFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown-source";
  }
}
