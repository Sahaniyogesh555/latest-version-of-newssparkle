// Factual consistency, originality and structure checks.
//
// This is the guardrail that stops the model inventing figures or copying a
// source. It cannot prove a story is true — nothing automatic can — so it is
// paired with (a) the model's own verification pass and (b) an attribution
// requirement, and any failure forces the draft into human review instead of
// publication.

import {
  contentTokens,
  extractEntities,
  extractNumbers,
  normalizeWhitespace,
  splitParagraphs,
  splitSentences,
  wordCount,
} from "./text.ts";
import type {
  GroundingReport,
  PlagiarismReport,
  SourceFeedItem,
  StructureReport,
} from "./types.ts";

/* -------------------------------------------------------------------------- */
/* Structure                                                                   */
/* -------------------------------------------------------------------------- */

export interface StructureOptions {
  minWords?: number;
  minH2?: number;
  minH3?: number;
  minParagraphs?: number;
  minLinks?: number;
}

export function structureReport(markdown: string, options: StructureOptions = {}): StructureReport {
  const { minWords = 220, minH2 = 2, minH3 = 1, minParagraphs = 5, minLinks = 0 } = options;
  const body = normalizeWhitespace(
    markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
  );

  const h2 = (markdown.match(/^##\s+\S/gm) ?? []).length;
  const h3 = (markdown.match(/^###\s+\S/gm) ?? []).length;
  const lists = (markdown.match(/^\s*(?:[-*+]|\d+\.)\s+\S/gm) ?? []).length;
  const links = (markdown.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
  const paragraphs = splitParagraphs(markdown.replace(/^#{1,6}.*$/gm, "")).filter(
    (p) => wordCount(p) >= 12,
  ).length;
  const words = wordCount(body);

  const issues: string[] = [];
  if (words < minWords) issues.push(`too-short:${words}<${minWords}`);
  if (h2 < minH2) issues.push(`few-h2:${h2}<${minH2}`);
  if (h3 < minH3) issues.push(`few-h3:${h3}<${minH3}`);
  if (paragraphs < minParagraphs) issues.push(`few-paragraphs:${paragraphs}<${minParagraphs}`);
  if (links < minLinks) issues.push(`few-links:${links}<${minLinks}`);

  return { ok: issues.length === 0, wordCount: words, paragraphs, h2, h3, lists, links, issues };
}

/* -------------------------------------------------------------------------- */
/* Plagiarism / verbatim copying                                              */
/* -------------------------------------------------------------------------- */

const PLAGIARISM_NGRAM = 8;

function normalisedWords(text: string): string[] {
  return normalizeWhitespace(text.toLowerCase())
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Longest verbatim run (in words) shared with any single source, plus the share
 * of the draft's 8-grams that appear in the source material.
 *
 * A newsroom-safe draft paraphrases: short factual phrases ("the central bank")
 * overlap legitimately, long runs do not.
 */
export function plagiarismReport(draft: string, sources: SourceFeedItem[]): PlagiarismReport {
  const draftWords = normalisedWords(draft);
  if (draftWords.length < PLAGIARISM_NGRAM || sources.length === 0) {
    return { maxRunLength: 0, overlapRatio: 0, risky: false };
  }

  const draftGrams = new Map<string, number>();
  for (let i = 0; i <= draftWords.length - PLAGIARISM_NGRAM; i++) {
    draftGrams.set(draftWords.slice(i, i + PLAGIARISM_NGRAM).join(" "), i);
  }

  let maxRun = 0;
  let matched = 0;
  let worstSource: string | undefined;

  for (const source of sources) {
    const sourceWords = normalisedWords(`${source.title}. ${source.snippet ?? ""}`);
    if (sourceWords.length < PLAGIARISM_NGRAM) continue;

    const sourceGrams = new Set<string>();
    for (let i = 0; i <= sourceWords.length - PLAGIARISM_NGRAM; i++) {
      sourceGrams.add(sourceWords.slice(i, i + PLAGIARISM_NGRAM).join(" "));
    }

    let sourceMatches = 0;
    const matchedIndexes: number[] = [];
    for (const [gram, index] of draftGrams) {
      if (sourceGrams.has(gram)) {
        sourceMatches++;
        matchedIndexes.push(index);
      }
    }
    matched = Math.max(matched, sourceMatches);
    if (!worstSource && sourceMatches > 0) worstSource = source.sourceName;

    // Longest consecutive run of matching windows → run length in words.
    matchedIndexes.sort((a, b) => a - b);
    let run = 0;
    let previous = -99;
    for (const index of matchedIndexes) {
      run = index === previous + 1 ? run + 1 : 1;
      previous = index;
      maxRun = Math.max(maxRun, run);
    }
  }

  const runWords = maxRun > 0 ? maxRun + PLAGIARISM_NGRAM - 1 : 0;
  const overlapRatio = Number((matched / draftGrams.size).toFixed(4));

  return {
    maxRunLength: runWords,
    overlapRatio,
    risky: runWords > 24 || overlapRatio > 0.22,
    worstSource,
  };
}

/* -------------------------------------------------------------------------- */
/* Attribution                                                                */
/* -------------------------------------------------------------------------- */

export interface AttributionReport {
  score: number; // 0..1
  mentions: string[];
  hasAttributionPhrase: boolean;
}

/**
 * Reporting clauses that count as attribution. Deliberately broad: a draft that
 * says "the regulator said" is sourced even if it never names the outlet, while
 * naming the outlet earns the higher score.
 */
const ATTRIBUTION_PHRASES =
  /\b(?:according to|reported by|in a statement|in its (?:report|statement|filing|filing))\b|\b(?:officials?|researchers?|analysts?|regulators?|ministers?|spokes(?:person|man|woman)|the (?:report|study|filing|statement|agency|regulator|ministry|department|company|panel|committee|union|body|bank|institute|court|force))\s+(?:said|says|added|confirmed|announced|reported|warned|told|found|shows|showed|argued|wrote)\b|\b\w+\s+(?:said|confirms|confirmed|announced|warned|added|reported)\b/i;

/**
 * Does the draft name this source? Full outlet names are matched as substrings,
 * four-letter-or-longer short names likewise, and three-letter acronyms (BBC,
 * NPR, WHO) on word boundaries so "who" in prose does not read as a credit.
 */
function isSourceMentioned(draftLower: string, sourceName: string): boolean {
  const full = sourceName.replace(/^www\./, "").toLowerCase().replace(/\s+/g, " ").trim();
  if (full.length >= 5 && draftLower.includes(full)) return true;

  const shortName = full.split(/[\s.]+/)[0];
  if (shortName.length >= 4) return draftLower.includes(shortName);
  if (shortName.length === 3) {
    const escaped = shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(draftLower);
  }
  return false;
}

export function attributionReport(draft: string, sources: SourceFeedItem[]): AttributionReport {
  const haystack = draft.toLowerCase();
  const mentions: string[] = [];

  for (const source of sources) {
    if (isSourceMentioned(haystack, source.sourceName)) mentions.push(source.sourceName);
  }

  const hasAttributionPhrase = ATTRIBUTION_PHRASES.test(draft);
  const distinct = new Set(mentions.map((m) => m.toLowerCase())).size;
  const score = Math.min(1, (distinct >= 2 ? 0.6 : distinct === 1 ? 0.4 : 0) + (hasAttributionPhrase ? 0.4 : 0));

  return { score: Number(score.toFixed(3)), mentions: [...new Set(mentions)], hasAttributionPhrase };
}

/* -------------------------------------------------------------------------- */
/* Numeric / entity grounding                                                 */
/* -------------------------------------------------------------------------- */

/** Loose equality for figures: "1,200" ≈ "1200", "12 percent" ≈ "12%". */
function canonicalNumber(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bpercent|per cent\b/g, "%")
    .replace(/\bbillion\b/g, "bn")
    .replace(/\bmillion\b/g, "m")
    .replace(/\btrillion\b/g, "tn")
    .replace(/[,\s]/g, "")
    .replace(/[^\da-z%.$€£]/g, "");
}

export function groundingReport(draft: string, sources: SourceFeedItem[]): GroundingReport {
  const sourceText = sources.map((s) => `${s.title} ${s.snippet ?? ""}`).join(" \n ");
  const sourceNumbers = new Set(extractNumbers(sourceText).map(canonicalNumber));
  const sourceLower = sourceText.toLowerCase();
  const notes: string[] = [];

  const draftNumbers = extractNumbers(draft);
  const numbersUnsupported = draftNumbers
    .filter((n) => {
      const canonical = canonicalNumber(n);
      if (!canonical) return false;
      if (sourceNumbers.has(canonical)) return false;
      // Accept a bare figure that appears inside a sourced compound figure.
      return ![...sourceNumbers].some((sn) => sn.includes(canonical) || canonical.includes(sn));
    })
    .filter((n, i, arr) => arr.indexOf(n) === i);

  const draftEntities = extractEntities(draft, 60);
  const entitiesUnsupported = draftEntities.filter((entity) => {
    const parts = entity.toLowerCase().split(/\s+/).filter((p) => p.length > 3);
    if (parts.length === 0) return false;
    return !parts.some((part) => sourceLower.includes(part));
  });

  const numbersTotal = draftNumbers.length;
  const entitiesTotal = draftEntities.length;

  const numberScore = numbersTotal === 0 ? 1 : 1 - numbersUnsupported.length / numbersTotal;
  const entityScore = entitiesTotal === 0 ? 1 : 1 - entitiesUnsupported.length / entitiesTotal;

  if (numbersUnsupported.length > 0) {
    notes.push(`${numbersUnsupported.length} figure(s) not found in the source material`);
  }
  if (entitiesUnsupported.length > 2) {
    notes.push(`${entitiesUnsupported.length} named reference(s) not found in the source material`);
  }

  const score = Number(Math.max(0, Math.min(1, numberScore * 0.65 + entityScore * 0.35)).toFixed(3));

  return {
    score,
    numbersTotal,
    numbersUnsupported,
    entitiesTotal,
    entitiesUnsupported: entitiesUnsupported.slice(0, 12),
    notes,
  };
}

/* -------------------------------------------------------------------------- */
/* Combined consistency verdict                                               */
/* -------------------------------------------------------------------------- */

export interface ConsistencyInput {
  draft: string;
  sources: SourceFeedItem[];
  modelSupported?: boolean;
  modelConfidence?: number;
}

export interface ConsistencyResult {
  ok: boolean;
  /** Hard problems: these must never reach publication unattended. */
  reasons: string[];
  /**
   * Softer concerns (thin attribution, low verifier confidence). They reduce
   * the quality score and appear in the review notes rather than blocking a
   * well-sourced article outright.
   */
  softReasons: string[];
  grounding: GroundingReport;
  plagiarism: PlagiarismReport;
  attribution: AttributionReport;
}

export function consistencyReport(input: ConsistencyInput): ConsistencyResult {
  const grounding = groundingReport(input.draft, input.sources);
  const plagiarism = plagiarismReport(input.draft, input.sources);
  const attribution = attributionReport(input.draft, input.sources);
  const reasons: string[] = [];
  const softReasons: string[] = [];

  if (plagiarism.risky) {
    reasons.push(
      `verbatim overlap with source (${plagiarism.maxRunLength} words, ${Math.round(plagiarism.overlapRatio * 100)}% of n-grams)`,
    );
  }
  if (grounding.numbersTotal >= 3 && grounding.numbersUnsupported.length / grounding.numbersTotal > 0.34) {
    reasons.push(
      `${grounding.numbersUnsupported.length}/${grounding.numbersTotal} figures are not supported by the sources`,
    );
  }
  if (attribution.score === 0 && input.sources.length >= 2) {
    softReasons.push("no attribution to any named source");
  }
  if (input.modelSupported === false) {
    // Soft by design: the quality gate turns this into a review hold, so an
    // over-cautious verdict cannot silently delete a good story.
    softReasons.push("verification pass could not confirm the article against its sources");
  }
  if (typeof input.modelConfidence === "number" && input.modelConfidence < 0.6) {
    softReasons.push(`verification confidence ${input.modelConfidence}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    softReasons,
    grounding,
    plagiarism,
    attribution,
  };
}

/** Short one-line summary used in logs and pipeline metrics. */
export function summarizeConsistency(result: ConsistencyResult): string {
  return [
    `grounding=${result.grounding.score}`,
    `overlap=${result.plagiarism.overlapRatio}`,
    `run=${result.plagiarism.maxRunLength}`,
    `attribution=${result.attribution.score}`,
  ].join(" ");
}

/** Sentences worth a human glance (figures with no source). */
export function flagUnsupportedClaims(draft: string, report: GroundingReport): string[] {
  if (report.numbersUnsupported.length === 0) return [];
  const wanted = new Set(report.numbersUnsupported.map((n) => canonicalNumber(n)));
  return splitSentences(draft)
    .filter((sentence) => extractNumbers(sentence).some((n) => wanted.has(canonicalNumber(n))))
    .slice(0, 5);
}

/** Cheapest possible readability gate for feed snippets before rewriting. */
export function isRewritableText(text: string): boolean {
  const tokens = contentTokens(text);
  return tokens.length >= 6;
}
