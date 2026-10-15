// Autonomous maintenance.
//
// The newsroom has no human rota, so the housekeeping that normally rots:
//   * sitemap / news sitemap / RSS freshness,
//   * stale stories that should be archived or updated,
//   * broken featured images and dead outbound links,
//   * orphaned posts with no internal links pointing at them,
//   * thin internal linking between related stories.
//
// This module is pure decision logic: it takes snapshots and returns findings.
// The `maintenance` edge function does the I/O, applying safe fixes
// automatically and recording anything that needs judgement.

import { contentTokens, extractNumbers, normalizeWhitespace, splitSentences, wordCount } from "./text.ts";
import { isUsableImageUrl } from "./images.ts";
import type { PostRow } from "./db.ts";

export const MAINTENANCE_RULES = {
  /** A published story older than this with no views gets a refresh review. */
  staleDays: 120,
  /** Stories older than this are archived from the index (kept on the site). */
  archiveAfterDays: 730,
  /** Endpoints must have been refreshed within this window. */
  endpointMaxAgeHours: 26,
  /** How many internal-link suggestions a story may receive per sweep. */
  maxLinkSuggestionsPerPost: 3,
  /** Outbound links checked per run (network budget). */
  maxLinkChecksPerRun: 25,
} as const;

export interface MaintenanceFinding {
  kind:
    | "stale-post"
    | "broken-image"
    | "broken-link"
    | "orphan-post"
    | "missing-internal-links"
    | "endpoint-stale"
    | "thin-content"
    | "duplicate-slug";
  severity: "info" | "warning" | "critical";
  subject: string;
  detail: string;
  /** True when the sweep can fix this without a human. */
  autoFixable: boolean;
  context?: Record<string, unknown>;
}

export interface EndpointSnapshot {
  name: string;
  url: string;
  checkedAt: string | null;
  ok: boolean;
  itemCount?: number;
  /** ETag or Last-Modified seen last time, for freshness checks. */
  lastModified?: string | null;
}

/** Sitemap / RSS / news-sitemap freshness. */
export function checkEndpoints(snapshots: EndpointSnapshot[], now: Date): MaintenanceFinding[] {
  const findings: MaintenanceFinding[] = [];
  for (const endpoint of snapshots) {
    if (!endpoint.ok) {
      findings.push({
        kind: "endpoint-stale",
        severity: "critical",
        subject: endpoint.name,
        detail: `${endpoint.url} failed its last check`,
        autoFixable: true,
        context: { url: endpoint.url },
      });
      continue;
    }
    const ageHours = endpoint.checkedAt ? (now.getTime() - Date.parse(endpoint.checkedAt)) / 3_600_000 : Infinity;
    if (ageHours > MAINTENANCE_RULES.endpointMaxAgeHours) {
      findings.push({
        kind: "endpoint-stale",
        severity: "warning",
        subject: endpoint.name,
        detail: `last refreshed ${Number.isFinite(ageHours) ? `${Math.round(ageHours)}h` : "never"} ago`,
        autoFixable: true,
        context: { url: endpoint.url, ageHours: Number.isFinite(ageHours) ? Math.round(ageHours) : null },
      });
    }
    if (endpoint.itemCount === 0) {
      findings.push({
        kind: "endpoint-stale",
        severity: "warning",
        subject: endpoint.name,
        detail: "endpoint responded but contains no items",
        autoFixable: false,
        context: { url: endpoint.url },
      });
    }
  }
  return findings;
}

export interface StalePost {
  id: string;
  slug: string;
  title: string;
  published_at: string | null;
  views: number | null;
  word_count?: number | null;
}

/** Stories that are old and either unseen or thin — candidates for refresh. */
export function findStalePosts(
  posts: StalePost[],
  now: Date,
  rules: { staleDays?: number; archiveAfterDays?: number } = {},
): MaintenanceFinding[] {
  const staleDays = rules.staleDays ?? MAINTENANCE_RULES.staleDays;
  const archiveDays = rules.archiveAfterDays ?? MAINTENANCE_RULES.archiveAfterDays;
  const findings: MaintenanceFinding[] = [];

  for (const post of posts) {
    if (!post.published_at) continue;
    const ageDays = (now.getTime() - Date.parse(post.published_at)) / 86_400_000;
    const views = post.views ?? 0;

    if (ageDays >= archiveDays && views < 50) {
      findings.push({
        kind: "stale-post",
        severity: "info",
        subject: post.slug,
        detail: `${Math.round(ageDays)} days old with ${views} views — archive from the index`,
        autoFixable: true,
        context: { id: post.id, ageDays: Math.round(ageDays), views, action: "archive" },
      });
      continue;
    }

    if (ageDays >= staleDays && views < 25) {
      findings.push({
        kind: "stale-post",
        severity: "warning",
        subject: post.slug,
        detail: `${Math.round(ageDays)} days old with only ${views} views — refresh or consolidate`,
        autoFixable: false,
        context: { id: post.id, ageDays: Math.round(ageDays), views, action: "refresh" },
      });
    }

    if ((post.word_count ?? 0) > 0 && (post.word_count ?? 0) < 200) {
      findings.push({
        kind: "thin-content",
        severity: "warning",
        subject: post.slug,
        detail: `only ${post.word_count} words — expand or merge into a related story`,
        autoFixable: false,
        context: { id: post.id, wordCount: post.word_count },
      });
    }
  }

  return findings;
}

/** Featured images that are missing or obviously unusable. */
export function findBrokenImages(posts: Array<Pick<PostRow, "id" | "slug" | "title" | "featured_image_url">>): MaintenanceFinding[] {
  return posts
    .filter((post) => !isUsableImageUrl(post.featured_image_url))
    .map((post) => ({
      kind: "broken-image" as const,
      severity: "warning" as const,
      subject: post.slug,
      detail: post.featured_image_url ? "featured image URL is not usable" : "featured image is missing",
      autoFixable: true,
      context: { id: post.id, url: post.featured_image_url ?? null },
    }));
}

/** Outbound links inside article bodies, with the sentence for context. */
export function extractOutboundLinks(content: string): Array<{ url: string; text: string }> {
  const links: Array<{ url: string; text: string }> = [];
  const markdown = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  for (const match of content.matchAll(markdown)) {
    links.push({ text: normalizeWhitespace(match[1]), url: match[2] });
  }
  for (const sentence of splitSentences(content)) {
    for (const match of sentence.matchAll(/https?:\/\/[^\s)]+/g)) {
      if (!links.some((link) => link.url === match[0])) {
        links.push({ url: match[0], text: normalizeWhitespace(sentence).slice(0, 120) });
      }
    }
  }
  return links;
}

/** Plan which links to verify, honouring the per-run network budget. */
export function planLinkChecks(
  posts: Array<{ slug: string; content: string | null | undefined }>,
  options: { maxChecks?: number; skipDomains?: string[] } = {},
): Array<{ slug: string; url: string }> {
  const maxChecks = options.maxChecks ?? MAINTENANCE_RULES.maxLinkChecksPerRun;
  const skip = new Set(options.skipDomains ?? []);
  const plan: Array<{ slug: string; url: string }> = [];
  const seen = new Set<string>();

  for (const post of posts) {
    if (!post.content) continue;
    for (const link of extractOutboundLinks(post.content)) {
      if (seen.has(link.url)) continue;
      try {
        const host = new URL(link.url).hostname;
        if (skip.has(host)) continue;
      } catch {
        continue;
      }
      seen.add(link.url);
      plan.push({ slug: post.slug, url: link.url });
      if (plan.length >= maxChecks) return plan;
    }
  }

  return plan;
}

/**
 * Posts that nothing links to. Internal links matter for readers and for the
 * crawl budget, and a story published at 3am never gets them organically.
 */
export function findOrphans(
  posts: Array<{ slug: string; title: string; category_slug?: string | null; published_at?: string | null }>,
  linkedSlugs: string[],
  options: { minAgeHours?: number; now?: Date; limit?: number } = {},
): MaintenanceFinding[] {
  const linked = new Set(linkedSlugs);
  const now = options.now ?? new Date();
  const minAgeHours = options.minAgeHours ?? 6;
  const limit = options.limit ?? 20;

  return posts
    .filter((post) => !linked.has(post.slug))
    .filter((post) => {
      if (!post.published_at) return true;
      return (now.getTime() - Date.parse(post.published_at)) / 3_600_000 >= minAgeHours;
    })
    .slice(0, limit)
    .map((post) => ({
      kind: "orphan-post" as const,
      severity: "info" as const,
      subject: post.slug,
      detail: "no internal links point at this story",
      autoFixable: true,
      context: { title: post.title, category: post.category_slug ?? null },
    }));
}

export interface LinkSuggestion {
  slug: string;
  title: string;
  score: number;
  reason: string;
}

/** Suggest related stories to link from a post (topic overlap + same section). */
export function suggestInternalLinks(
  post: { slug: string; title: string; category_slug?: string | null; content?: string | null },
  corpus: Array<{ slug: string; title: string; category_slug?: string | null }>,
  options: { limit?: number; minScore?: number } = {},
): LinkSuggestion[] {
  const limit = options.limit ?? MAINTENANCE_RULES.maxLinkSuggestionsPerPost;
  const minScore = options.minScore ?? 0.18;
  const postTokens = new Set(contentTokens(`${post.title} ${(post.content ?? "").slice(0, 1200)}`));
  if (postTokens.size === 0) return [];

  const alreadyLinked = new Set(
    extractOutboundLinks(post.content ?? "")
      .map((link) => link.url.split("/").filter(Boolean).pop() ?? "")
      .filter((slug) => slug.length > 0),
  );

  return corpus
    .filter((candidate) => candidate.slug !== post.slug && !alreadyLinked.has(candidate.slug))
    .map((candidate) => {
      const tokens = contentTokens(candidate.title);
      if (tokens.length === 0) return { candidate, score: 0 };
      const shared = tokens.filter((token) => postTokens.has(token)).length;
      const overlap = shared / tokens.length;
      const sameSection = candidate.category_slug && candidate.category_slug === post.category_slug ? 0.1 : 0;
      return { candidate, score: overlap + sameSection };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      slug: entry.candidate.slug,
      title: entry.candidate.title,
      score: Number(entry.score.toFixed(3)),
      reason: entry.candidate.category_slug === post.category_slug ? "same section, shared terms" : "shared terms",
    }));
}

/** Stories whose numbers disagree with each other — a typical rewriting slip. */
export function findInconsistentNumbers(
  posts: Array<{ slug: string; title: string; content: string | null | undefined }>,
): MaintenanceFinding[] {
  const findings: MaintenanceFinding[] = [];
  for (const post of posts) {
    if (!post.content) continue;
    const numbers = extractNumbers(post.content);
    if (numbers.length < 8) continue;
    const counts = new Map<string, number>();
    for (const number of numbers) counts.set(number.toLowerCase(), (counts.get(number.toLowerCase()) ?? 0) + 1);
    const suspicious = [...counts.entries()].filter(([, count]) => count > 12);
    if (suspicious.length > 0) {
      findings.push({
        kind: "thin-content",
        severity: "info",
        subject: post.slug,
        detail: `figures repeated ${suspicious[0][1]} times (${suspicious[0][0]}) — check for padding`,
        autoFixable: false,
        context: { figure: suspicious[0][0], count: suspicious[0][1] },
      });
    }
  }
  return findings;
}

/** Overall health verdict for the run, used by the monitor and alerts. */
export function summariseFindings(findings: MaintenanceFinding[]): {
  ok: boolean;
  byKind: Record<string, number>;
  critical: number;
  autoFixable: number;
  worstSubjects: string[];
} {
  const byKind: Record<string, number> = {};
  let critical = 0;
  let autoFixable = 0;
  for (const finding of findings) {
    byKind[finding.kind] = (byKind[finding.kind] ?? 0) + 1;
    if (finding.severity === "critical") critical++;
    if (finding.autoFixable) autoFixable++;
  }
  return {
    ok: critical === 0,
    byKind,
    critical,
    autoFixable,
    worstSubjects: findings
      .filter((finding) => finding.severity !== "info")
      .slice(0, 10)
      .map((finding) => finding.subject),
  };
}

/** Content gap report for the ops summary: which sections have too little. */
export function sectionBalance(
  publishedToday: Record<string, number>,
  available: Record<string, number>,
  categories: string[],
): Array<{ category: string; published: number; waiting: number; status: "ok" | "thin" | "empty" }> {
  return categories.map((category) => {
    const published = publishedToday[category] ?? 0;
    const waiting = available[category] ?? 0;
    const status: "ok" | "thin" | "empty" = published === 0 && waiting === 0 ? "empty" : published === 0 ? "thin" : "ok";
    return { category, published, waiting, status };
  });
}

/** Word-count guard used before publishing a maintenance-suggested edit. */
export function isSubstantiveBody(content: string | null | undefined, minWords = 120): boolean {
  return wordCount(normalizeWhitespace(content ?? "")) >= minWords;
}
