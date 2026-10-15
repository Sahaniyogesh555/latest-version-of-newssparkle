// Duplicate detection.
//
// Three layers, cheapest first:
//   1. fingerprint  – order-insensitive hash of a headline's content words.
//                     Same story from several feeds collapses to one row.
//   2. shingle Jaccard – near-duplicate headlines ("Central bank holds rates"
//                     vs "Central bank keeps rates unchanged").
//   3. simhash      – 64-bit locality-sensitive hash of the full text, used to
//                     catch near-duplicate articles and SEO cannibalisation.
//
// Pure functions only (no Date.now, no randomness) so behaviour is repeatable.

import { contentTokens, hash64, normalizeWhitespace, stemTokens } from "./text.ts";

const similarityTokens = (text: string): string[] => stemTokens(contentTokens(text));

const FNV_OFFSET = 0xcbf29ce484222325n;
const MASK64 = (1n << 64n) - 1n;

/** Strip publisher suffixes and boilerplate before comparing headlines. */
export function normalizeHeadline(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+[-–—|]\s+[a-z0-9 .'&]{2,30}$/i, " ") // " - BBC News"
    .replace(/\((?:video|photos?|live|update[sd]?|watch|audio)\)/gi, " ")
    .replace(/\b(?:live|updated|breaking|exclusive|opinion|analysis|watch|video)\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Top content tokens, sorted, so word order does not matter. */
export function fingerprint(title: string): string {
  const tokens = [...new Set(similarityTokens(normalizeHeadline(title)))].sort();
  if (tokens.length === 0) return hash64(normalizeHeadline(title) || title.trim().toLowerCase());
  return hash64(tokens.join(" "));
}

export function shingles(text: string, size = 3): Set<string> {
  const tokens = similarityTokens(text);
  const out = new Set<string>();
  if (tokens.length < size) {
    if (tokens.length > 0) out.add(tokens.join(" "));
    return out;
  }
  for (let i = 0; i <= tokens.length - size; i++) {
    out.add(tokens.slice(i, i + size).join(" "));
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const value of small) if (large.has(value)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Overlap coefficient: shared items over the size of the smaller set.
 * News headlines vary a lot in length, so containment catches "short headline
 * fully absorbed by a longer one" where Jaccard under-reports similarity.
 */
export function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let intersection = 0;
  for (const value of small) if (large.has(value)) intersection++;
  return intersection / small.size;
}

/**
 * Title similarity in 0..1, blending word choice, word order and shared
 * opening phrases (headlines tend to lead with the subject).
 *
 * Calibrated against real feed pairs:
 *   "Central bank holds interest rates steady" / "Central bank keeps interest rates unchanged" -> ~0.59
 *   "Storm cuts power to 90,000 homes" / "90,000 homes lose power in storm"                     -> ~0.61
 *   unrelated headlines                                                                          -> ~0.00
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeHeadline(a);
  const nb = normalizeHeadline(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const tokensA = new Set(similarityTokens(na));
  const tokensB = new Set(similarityTokens(nb));
  const tokenContainment = containment(tokensA, tokensB);
  const tokenJaccard = jaccard(tokensA, tokensB);
  const bigramContainment = containment(shingles(na, 2), shingles(nb, 2));

  let score = tokenContainment * 0.45 + tokenJaccard * 0.2 + bigramContainment * 0.35;

  // Shared leading phrase ("Central bank ...") is strong same-story evidence.
  const leadA = similarityTokens(na).slice(0, 2).join(" ");
  const leadB = similarityTokens(nb).slice(0, 2).join(" ");
  if (leadA.length > 0 && leadA === leadB) score += 0.05;

  return Number(Math.min(1, score).toFixed(4));
}

/**
 * Content similarity in 0..1 for full article bodies.
 *
 * Four-word shingles are the primary measure (a light-edit rewrite scores
 * ~0.53 while an independently written piece on the same event scores ~0.00),
 * with the simhash hamming distance as a fallback for very short texts.
 */
export function contentSimilarity(a: string, b: string): number {
  const textA = normalizeWhitespace(a ?? "");
  const textB = normalizeWhitespace(b ?? "");
  if (!textA || !textB) return 0;
  const shinglesA = shingles(textA, 4);
  const shinglesB = shingles(textB, 4);
  if (shinglesA.size >= 3 && shinglesB.size >= 3) {
    return Number(jaccard(shinglesA, shinglesB).toFixed(4));
  }
  return simhashSimilarity(simhash(textA), simhash(textB));
}

function tokenHash(token: string): bigint {
  let hash = FNV_OFFSET;
  for (let i = 0; i < token.length; i++) {
    hash ^= BigInt(token.charCodeAt(i));
    hash = (hash * 0x100000001b3n) & MASK64;
  }
  return hash;
}

/**
 * 64-bit simhash over stemmed 3-word shingles.
 *
 * Shingles rather than single words: a reworded sentence keeps most of its
 * words but breaks its shingles, so two articles that merely share a subject
 * vocabulary stay far apart while genuine rewrites of the same copy stay close.
 */
export function simhash(text: string): bigint {
  const tokens = similarityTokens(text);
  const weights = new Map<string, number>();
  if (tokens.length < 3) {
    for (const token of tokens) weights.set(token, (weights.get(token) ?? 0) + 1);
  } else {
    // Cap the shingle window on very long articles so hashing stays O(n).
    const step = tokens.length > 4000 ? 2 : 1;
    for (let i = 0; i + 3 <= tokens.length; i += step) {
      const shingle = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
      weights.set(shingle, (weights.get(shingle) ?? 0) + 1);
    }
  }

  const vector = new Array<number>(64).fill(0);
  for (const [token, weight] of weights) {
    const hash = tokenHash(token);
    for (let bit = 0; bit < 64; bit++) {
      const isSet = (hash >> BigInt(bit)) & 1n;
      vector[bit] += isSet === 1n ? weight : -weight;
    }
  }

  let result = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (vector[bit] > 0) result |= 1n << BigInt(bit);
  }
  return result;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = (a ^ b) & MASK64;
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

/** 1 = identical text, 0 = unrelated. */
export function simhashSimilarity(a: bigint, b: bigint): number {
  return Number((1 - hammingDistance(a, b) / 64).toFixed(4));
}

export interface DedupeThresholds {
  /** Above this, two headlines are treated as the same story. */
  titleDuplicate: number;
  /** Above this, two headlines are "too close" and need a rewrite/reject. */
  titleNear: number;
  /** Above this, two article bodies are near duplicates and are blocked. */
  contentDuplicate: number;
  /** Above this, bodies are close enough to send to human review. */
  contentNear: number;
}

/** Defaults measured against labelled sample pairs (see the unit tests). */
export const DEFAULT_DEDUPE_THRESHOLDS: DedupeThresholds = {
  titleDuplicate: 0.72,
  titleNear: 0.55,
  contentDuplicate: 0.38,
  contentNear: 0.2,
};

// Note (Phase 6.1): the archive comparison loads full bodies for the last 7
// days (80 posts), so it runs the exact 4-shingle Jaccard in contentSimilarity.
// simhash stays in the database for cheap fingerprinting and future range
// queries; an unused "prefilter bit budget" constant used to live here and was
// removed because nothing read it.

export interface DuplicateVerdict {
  duplicate: boolean;
  severity: "none" | "near" | "duplicate";
  reason: string;
  titleSimilarity?: number;
  contentSimilarity?: number;
  matchedTitle?: string;
}

export interface ComparablePost {
  title: string;
  /** Precomputed simhash (avoids rehashing the archive on every run). */
  hash?: bigint;
  slug?: string;
  /** Full body text; when present the exact shingle comparison is used. */
  content?: string;
}

/**
 * Compare a candidate against existing titles/bodies.
 * `existing` items may carry a precomputed simhash (avoid rehashing archives).
 */
export function findDuplicate(
  candidate: { title: string; content?: string; slug?: string },
  existing: ComparablePost[],
  options: { content?: string; thresholds?: Partial<DedupeThresholds>; candidateHash?: bigint } = {},
): DuplicateVerdict {
  const thresholds = { ...DEFAULT_DEDUPE_THRESHOLDS, ...options.thresholds };
  const candidateHash = options.candidateHash ?? (options.content ? simhash(options.content) : undefined);

  let bestTitle = 0;
  let bestTitleMatch: string | undefined;

  for (const post of existing) {
    if (candidate.slug && post.slug && candidate.slug === post.slug) {
      return { duplicate: true, severity: "duplicate", reason: "slug-collision", matchedTitle: post.title };
    }
    const similarity = titleSimilarity(candidate.title, post.title);
    if (similarity > bestTitle) {
      bestTitle = similarity;
      bestTitleMatch = post.title;
    }
    if (similarity >= thresholds.titleDuplicate) {
      return {
        duplicate: true,
        severity: "duplicate",
        reason: "title-duplicate",
        titleSimilarity: Number(similarity.toFixed(4)),
        matchedTitle: post.title,
      };
    }
  }

  let bestContent = 0;
  const candidateContent = options.content ?? candidate.content;
  for (const post of existing) {
    let similarity = 0;
    if (candidateContent && post.content) {
      similarity = contentSimilarity(candidateContent, post.content);
    } else if (candidateHash !== undefined && post.hash) {
      similarity = simhashSimilarity(candidateHash, post.hash);
    } else {
      continue;
    }
    if (similarity > bestContent) {
      bestContent = similarity;
      bestTitleMatch = bestTitleMatch ?? post.title;
    }
  }

  if (bestContent >= thresholds.contentDuplicate) {
    return {
      duplicate: true,
      severity: "duplicate",
      reason: "content-duplicate",
      contentSimilarity: Number(bestContent.toFixed(4)),
      matchedTitle: bestTitleMatch,
    };
  }

  if (bestContent >= thresholds.contentNear) {
    return {
      duplicate: false,
      severity: "near",
      reason: "content-near-duplicate",
      contentSimilarity: Number(bestContent.toFixed(4)),
      matchedTitle: bestTitleMatch,
    };
  }

  if (bestTitle >= thresholds.titleNear) {
    return {
      duplicate: false,
      severity: "near",
      reason: "title-near-duplicate",
      titleSimilarity: Number(bestTitle.toFixed(4)),
      matchedTitle: bestTitleMatch,
    };
  }

  return {
    duplicate: false,
    severity: "none",
    reason: "unique",
    titleSimilarity: bestTitle ? Number(bestTitle.toFixed(4)) : undefined,
    contentSimilarity: bestContent ? Number(bestContent.toFixed(4)) : undefined,
  };
}

/** Duplication risk 0..1 used by the quality scorer (higher = riskier). */
export function duplicationRisk(
  verdict: DuplicateVerdict,
  thresholds: DedupeThresholds = DEFAULT_DEDUPE_THRESHOLDS,
): number {
  if (verdict.severity === "duplicate") return 1;
  const titleRisk = (verdict.titleSimilarity ?? 0) / thresholds.titleDuplicate;
  const contentRisk = (verdict.contentSimilarity ?? 0) / thresholds.contentDuplicate;
  return Number(Math.min(0.95, Math.max(titleRisk, contentRisk)).toFixed(3));
}

/** Collapse a batch of feed items, keeping the most trustworthy copy. */
export function dedupeBatch<T extends { title: string; trustTier?: number }>(items: T[]): {
  kept: T[];
  dropped: Array<{ item: T; reason: string; duplicateOf: string }>;
} {
  const byFingerprint = new Map<string, T>();
  const dropped: Array<{ item: T; reason: string; duplicateOf: string }> = [];

  for (const item of items) {
    const key = fingerprint(item.title);
    const existing = byFingerprint.get(key);
    if (!existing) {
      byFingerprint.set(key, item);
      continue;
    }
    const existingTier = existing.trustTier ?? 2;
    const incomingTier = item.trustTier ?? 2;
    if (incomingTier < existingTier) {
      dropped.push({ item: existing, reason: "duplicate-headline", duplicateOf: item.title });
      byFingerprint.set(key, item);
      continue;
    }
    dropped.push({ item, reason: "duplicate-headline", duplicateOf: existing.title });
  }

  // Second pass: catch reworded headlines that fingerprint missed.
  const kept: T[] = [];
  for (const item of byFingerprint.values()) {
    const index = kept.findIndex(
      (k) => titleSimilarity(k.title, item.title) >= DEFAULT_DEDUPE_THRESHOLDS.titleNear,
    );
    if (index === -1) {
      kept.push(item);
      continue;
    }
    // Same story told twice: keep the more trustworthy sourcing.
    const clash = kept[index];
    const incomingTier = item.trustTier ?? 2;
    const clashTier = clash.trustTier ?? 2;
    if (incomingTier < clashTier) {
      dropped.push({ item: clash, reason: "near-duplicate-headline", duplicateOf: item.title });
      kept[index] = item;
    } else {
      dropped.push({ item, reason: "near-duplicate-headline", duplicateOf: clash.title });
    }
  }

  return { kept, dropped };
}
