// Quality scoring: every article gets a 0–100 score and a verdict.
//
//   >= 75  → publish
//   55–74  → human review queue
//   < 55   → reject
//
// Blocking rules (safety, plagiarism, unsupported figures, duplicates) reject
// regardless of score. The breakdown is stored on the post so a reviewer can
// see exactly why an article scored what it did.

import { averageSentenceLength, fleschReadingEase, wordCount } from "./text.ts";
import { consistencyReport, structureReport, type ConsistencyResult } from "./facts.ts";
import { prepareSeoBundle, validateHeadline, validateKeywordUsage } from "./seo.ts";
import { mergeSafetyReports, scanSafety } from "./safety.ts";
import type { QualityBreakdown, QualityInput, QualityReport } from "./types.ts";

export const QUALITY_THRESHOLDS = {
  publish: 75,
  review: 55,
  /** Below this share of the word target a draft is treated as truncated. */
  minCompletion: 0.55,
  maxAverageSentenceLength: 30,
};

/** Weights must sum to 100. */
const WEIGHTS = {
  completeness: 20,
  readability: 15,
  structure: 15,
  seo: 15,
  trust: 15,
  factual: 10,
  originality: 10,
} as const;

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function scale(value: number, max: number): number {
  return Number((clamp(value) * max).toFixed(2));
}

/** Completeness: length against target plus the required editorial furniture. */
function scoreCompleteness(input: QualityInput, words: number): number {
  const target = input.targetWords ?? 350;
  const ratio = clamp(words / target);
  const truncated = ratio < QUALITY_THRESHOLDS.minCompletion;

  let score = ratio;
  if (!input.excerpt || input.excerpt.length < 60) score -= 0.15;
  if (!input.keyTakeaways || input.keyTakeaways.length < 3) score -= 0.1;
  if (!input.faq || input.faq.length < 2) score -= 0.05;
  if (truncated) score -= 0.25;

  return clamp(score);
}

/**
 * Readability: Flesch band plus sentence length.
 *
 * News prose reads comfortably between 30 (analysis) and 80 (wire copy), so the
 * band is wide and the penalty slides rather than zeroing out — an AI draft with
 * one long sentence should lose points, not the whole readability component.
 */
function scoreReadability(content: string): number {
  const flesch = fleschReadingEase(content);
  const bandPenalty = flesch >= 30 && flesch <= 80 ? 0 : Math.min(1, Math.abs(flesch - 55) / 60);
  const sentencePenalty = Math.min(
    1,
    Math.max(0, averageSentenceLength(content) - 28) / 22,
  );
  return clamp(1 - bandPenalty * 0.7 - sentencePenalty * 0.3);
}

function scoreStructure(content: string, target: number): number {
  const report = structureReport(content, {
    minWords: Math.round(target * 0.6),
    minH2: 2,
    minH3: 1,
    minParagraphs: 4,
  });
  const parts = [
    report.h2 >= 2 ? 1 : report.h2 / 2,
    report.h3 >= 1 ? 1 : 0,
    clamp(report.paragraphs / 5),
    clamp(report.wordCount / Math.max(1, target * 0.8)),
    report.lists >= 1 ? 1 : 0.6,
  ];
  const ratio = parts.reduce((a, b) => a + b, 0) / parts.length;
  return clamp(ratio - (report.ok ? 0 : 0.05));
}

/** SEO: headline, meta fields and keyword hygiene. */
function scoreSeo(input: QualityInput): { score: number; issues: string[] } {
  const issues: string[] = [];
  const headline = validateHeadline(input.title);
  issues.push(...headline.issues);

  const { validation } = prepareSeoBundle({
    title: input.title,
    excerpt: input.excerpt,
    content: input.content,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    keywords: input.keywords,
  });
  // prepareSeoBundle *fixes* what it can, so only generation-side problems
  // remain as issues (the fixed values are always published).
  const generationIssues = validation.issues.filter((i) => i.startsWith("generated:"));

  const keywordUsage = validateKeywordUsage(
    `${input.title} ${input.excerpt} ${input.content}`,
    input.keywords ?? [],
  );

  const parts = [
    headline.ok ? 1 : clamp(1 - headline.issues.length * 0.25),
    generationIssues.length === 0 ? 1 : 0.7,
    keywordUsage.ok ? 1 : clamp(1 - keywordUsage.issues.length * 0.2),
  ];
  return { score: clamp(parts.reduce((a, b) => a + b, 0) / parts.length), issues };
}

/** Trust: safety, attribution and the verification pass. */
function scoreTrust(input: QualityInput, consistency: ConsistencyResult): { score: number; issues: string[] } {
  const issues: string[] = [];
  const safety = mergeSafetyReports(
    input.safety ?? scanSafety(input.title),
    scanSafety(`${input.title}. ${input.content.slice(0, 4000)}`),
  );
  if (safety.flags.some((f) => f.severity === "critical")) issues.push("safety-critical");
  if (safety.clickbait) issues.push("clickbait");

  let score = 1;
  if (safety.flags.some((f) => f.severity === "critical")) score -= 1;
  else if (safety.flags.length > 0) score -= 0.25;

  score -= (1 - consistency.attribution.score) * 0.35;

  if (input.verification?.modelSupported === false) score -= 0.4;
  if (typeof input.verification?.modelConfidence === "number") {
    score -= clamp(1 - input.verification.modelConfidence) * 0.2;
  }

  return { score: clamp(score), issues };
}

export interface QualityEvaluation {
  report: QualityReport;
  consistency: ConsistencyResult;
}

export function evaluateQuality(input: QualityInput): QualityEvaluation {
  const words = wordCount(input.content);
  const target = input.targetWords ?? 350;

  const consistency = consistencyReport({
    draft: `${input.title}\n\n${input.content}`,
    sources: input.sources ?? [],
    modelSupported: input.verification?.modelSupported,
    modelConfidence: input.verification?.modelConfidence,
  });

  const completeness = scoreCompleteness(input, words);
  const readability = scoreReadability(input.content);
  const structure = scoreStructure(input.content, target);
  const seo = scoreSeo(input);
  const trust = scoreTrust(input, consistency);

  const grounding = input.grounding ?? consistency.grounding;
  const plagiarism = input.plagiarism ?? consistency.plagiarism;
  const factual = clamp(grounding.score);

  const risk = clamp(input.duplicationRisk ?? 0);
  const overlapPenalty = clamp(plagiarism.overlapRatio / 0.22) * 0.5;
  const originality = clamp(1 - risk - overlapPenalty);

  const breakdown: QualityBreakdown = {
    completeness: scale(completeness, WEIGHTS.completeness),
    readability: scale(readability, WEIGHTS.readability),
    structure: scale(structure, WEIGHTS.structure),
    seo: scale(seo.score, WEIGHTS.seo),
    trust: scale(trust.score, WEIGHTS.trust),
    factual: scale(factual, WEIGHTS.factual),
    originality: scale(originality, WEIGHTS.originality),
  };

  const score = Number(
    Object.values(breakdown).reduce((sum, value) => sum + value, 0).toFixed(1),
  );

  const blockingReasons: string[] = [];
  const reviewReasons: string[] = [];
  const warnings: string[] = [];

  if (trust.issues.includes("safety-critical")) blockingReasons.push("safety: critical content flag");
  if (plagiarism.risky) {
    blockingReasons.push(
      `originality: ${plagiarism.maxRunLength}-word verbatim run with ${plagiarism.worstSource ?? "a source"}`,
    );
  }
  if (risk >= 1) blockingReasons.push("duplicate: matches an already published story");
  if (words < target * QUALITY_THRESHOLDS.minCompletion) {
    blockingReasons.push(`completeness: only ${words} words of a ${target}-word target`);
  }
  if (grounding.numbersTotal >= 3 && grounding.numbersUnsupported.length / grounding.numbersTotal > 0.5) {
    blockingReasons.push("factual: most figures are unsupported by the sources");
  }
  if (input.verification?.modelSupported === false) {
    // Held for a human rather than discarded: an unverified draft may simply be
    // a cautious verdict, and it must never be published unattended.
    reviewReasons.push("verification: model could not confirm claims against sources");
  }
  if (typeof input.verification?.modelConfidence === "number" && input.verification.modelConfidence < 0.65) {
    reviewReasons.push(`verification: low confidence (${input.verification.modelConfidence})`);
  }
  if (!consistency.ok) {
    blockingReasons.push(...consistency.reasons.filter((r) => !blockingReasons.includes(r)));
  }

  warnings.push(
    ...seo.issues,
    ...trust.issues.filter((i) => i !== "safety-critical"),
    ...consistency.softReasons,
  );
  if (risk > 0.6 && risk < 1) warnings.push("duplication risk is elevated");

  let verdict: QualityReport["verdict"];
  if (blockingReasons.length > 0) verdict = "reject";
  else if (reviewReasons.length > 0) verdict = "review";
  else if (score >= QUALITY_THRESHOLDS.publish) verdict = "publish";
  else if (score >= QUALITY_THRESHOLDS.review) verdict = "review";
  else verdict = "reject";

  return {
    report: {
      score,
      verdict,
      breakdown,
      blockingReasons,
      reviewReasons: [...new Set(reviewReasons)],
      warnings: [...new Set(warnings)],
    },
    consistency,
  };
}

/** One-line summary for logs and operator alerts. */
export function summarizeQuality(report: QualityReport): string {
  const parts = [
    `score=${report.score}`,
    `verdict=${report.verdict}`,
    `completeness=${report.breakdown.completeness}`,
    `trust=${report.breakdown.trust}`,
    `originality=${report.breakdown.originality}`,
  ];
  if (report.blockingReasons.length > 0) parts.push(`blocked=${report.blockingReasons.length}`);
  return parts.join(" ");
}
