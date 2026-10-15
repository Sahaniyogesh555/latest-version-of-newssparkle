// Automatic section classification with confidence scoring.
//
// A transparent lexicon scorer: no model call needed, fully deterministic and
// cheap to run on every ingested item. The model is asked to confirm the
// category during the rewrite step, and any disagreement is logged so drift can
// be detected (see maintenance + detectMisclassification).

import { isStopword, normalizeWhitespace } from "./text.ts";
import type { CategorySlug, ClassificationResult } from "./types.ts";

/** Terms are matched as whole words against title/body tokens. */
const LEXICON: Record<CategorySlug, string[]> = {
  "breaking-news": [
    "urgent", "evacuated", "evacuation", "earthquake", "wildfire", "flood", "flooding",
    "storm", "hurricane", "typhoon", "explosion", "blast", "crash", "derailed", "rescue",
    "casualties", "death", "toll", "emergency", "alert", "hostage", "shooting", "missing",
    "collapse", "outage", "blackout", "recall", "outbreak", "evacuations",
  ],
  world: [
    "united", "nations", "diplomat", "diplomatic", "treaty", "summit", "border", "embassy",
    "sanctions", "foreign", "minister", "geopolitics", "ceasefire", "peacekeeping",
    "nato", "european", "union", "g7", "g20", "brics", "refugee", "migration", "migrant",
    "import", "export", "tariff", "global", "overseas", "africa", "asia", "latin",
  ],
  politics: [
    "election", "elections", "parliament", "congress", "senate", "senator", "vote",
    "voters", "ballot", "campaign", "candidate", "policy", "legislation", "bill",
    "lawmakers", "government", "minister", "governor", "mayor", "council", "budget",
    "tax", "regulation", "regulator", "coalition", "opposition", "referendum", "impeachment",
  ],
  business: [
    "market", "markets", "stocks", "shares", "earnings", "revenue", "profit", "inflation",
    "interest", "rates", "economy", "economic", "gdp", "unemployment", "jobs", "layoffs",
    "merger", "acquisition", "ipo", "investors", "investment", "fund", "bond", "yield",
    "retail", "sales", "startup", "valuation", "bank", "banking", "tariffs", "trade",
    // Consumer and commodity economics: an energy-prices story is business news,
    // not political process news, even when a regulator is the source.
    "price", "prices", "pricing", "energy", "gas", "oil", "fuel", "bills", "cost", "costs",
    "consumer", "consumers", "utility", "utilities", "mortgage", "mortgages", "rent", "rents",
    "wage", "wages", "pension", "pensions", "taxes", "levy", "subsidy", "subsidies",
  ],
  technology: [
    "software", "hardware", "chip", "chips", "semiconductor", "ai", "artificial",
    "intelligence", "algorithm", "model", "models", "cybersecurity", "hack", "hacked",
    "breach", "malware", "ransomware", "privacy", "encryption", "app", "apps", "platform",
    "cloud", "data", "dataset", "robotics", "quantum", "satellite", "device", "smartphone",
    "update", "bug", "open", "source", "developer", "api", "compute", "gpu",
  ],
  health: [
    "health", "medical", "medicine", "patients", "hospital", "doctor", "doctors", "nurse",
    "clinical", "trial", "vaccine", "vaccination", "virus", "infection", "disease",
    "diagnosis", "treatment", "therapy", "cancer", "diabetes", "mental", "wellbeing",
    "nutrition", "diet", "exercise", "fitness", "sleep", "symptoms", "fda", "healthcare",
  ],
  entertainment: [
    "film", "movie", "cinema", "actor", "actress", "director", "series", "season",
    "episode", "streaming", "netflix", "album", "song", "singer", "band", "tour",
    "concert", "festival", "awards", "oscars", "grammy", "celebrity", "studio", "box",
    "office", "show", "cast", "trailer", "premiere", "music",
  ],
  sports: [
    "match", "matches", "league", "cup", "tournament", "championship", "team", "teams",
    "coach", "player", "players", "club", "transfer", "goal", "goals", "score", "scored",
    "season", "fixture", "olympic", "olympics", "medal", "cricket", "football", "soccer",
    "basketball", "tennis", "golf", "rugby", "nba", "nfl", "fifa", "uefa", "ipl",
  ],
};

/** Headline terms count for more than body terms. */
const WEIGHT_TITLE = 3;
const WEIGHT_KEYWORDS = 2;
const WEIGHT_BODY = 1;

/** Categories that should win a tie: specific beats generic. */
const SPECIFICITY: Record<CategorySlug, number> = {
  "breaking-news": 0.9,
  sports: 1.05,
  health: 1.05,
  technology: 1.05,
  entertainment: 1.05,
  business: 1.02,
  politics: 1.0,
  world: 0.95,
};

/**
 * Classifier tokeniser: unlike `contentTokens` it keeps two-character terms
 * ("AI", "IPO", "NBA", "GPU") which matter a great deal for section scoring.
 */
function classifyTokens(text: string): Set<string> {
  const tokens = normalizeWhitespace(text.toLowerCase())
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter((t) => t.length >= 2 && !isStopword(t));
  return new Set(tokens);
}

export interface ClassifyInput {
  title: string;
  snippet?: string | null;
  keywords?: string[];
  /** Category of the source feed — a prior, not a decision. */
  sourceHint?: string | null;
  /** Known trend topic boost, optionally provided by trend-watch. */
  trendCategory?: string | null;
}

export function scoreCategories(input: ClassifyInput): Record<string, number> {
  const titleTokens = classifyTokens(input.title);
  const bodyTokens = classifyTokens(input.snippet ?? "");
  const keywordTokens = classifyTokens((input.keywords ?? []).join(" "));

  const scores: Record<string, number> = {};
  for (const [slug, terms] of Object.entries(LEXICON) as Array<[CategorySlug, string[]]>) {
    let score = 0;
    for (const term of terms) {
      if (titleTokens.has(term)) score += WEIGHT_TITLE;
      if (keywordTokens.has(term)) score += WEIGHT_KEYWORDS;
      if (bodyTokens.has(term)) score += WEIGHT_BODY;
    }
    if (score > 0) scores[slug] = score * SPECIFICITY[slug];
  }
  return scores;
}

const CONFIDENCE_FLOOR = 0.55;

export function classifyCategory(input: ClassifyInput): ClassificationResult {
  const scores = scoreCategories(input);
  const ranked = Object.entries(scores)
    .map(([slug, score]) => ({ slug: slug as CategorySlug, score: Number(score.toFixed(2)) }))
    .sort((a, b) => b.score - a.score);

  const hint = (input.sourceHint ?? undefined) as CategorySlug | undefined;
  const hintValid = hint && hint in LEXICON ? hint : undefined;
  const trendValid =
    input.trendCategory && input.trendCategory in LEXICON
      ? (input.trendCategory as CategorySlug)
      : undefined;

  if (ranked.length === 0) {
    const fallback = hintValid ?? trendValid ?? "world";
    return {
      slug: fallback,
      confidence: hintValid ? 0.6 : 0.35,
      method: hintValid ? "source-hint" : "fallback",
      scores: {},
      alternates: [],
    };
  }

  const top = ranked[0];
  const second = ranked[1];
  const margin = second ? (top.score - second.score) / Math.max(top.score, 0.001) : 1;
  const volume = Math.min(1, (scores[top.slug] ?? 0) / 9);
  const hintBonus = hintValid === top.slug ? 0.08 : 0;

  let confidence = 0.4 + margin * 0.35 + volume * 0.3 + hintBonus;
  confidence = Number(Math.max(0.3, Math.min(0.98, confidence)).toFixed(3));

  const weak = confidence < CONFIDENCE_FLOOR;
  const chosen = weak && hintValid ? hintValid : top.slug;

  return {
    slug: chosen,
    confidence,
    method: weak && hintValid ? "source-hint" : "lexicon",
    scores,
    alternates: ranked.slice(1, 4).map(({ slug, score }) => ({ slug, score })),
  };
}

/**
 * Compare a stored category with a fresh classification.
 * Used by maintenance to surface drift (e.g. content that belongs in an
 * unmapped section such as sports).
 */
export function detectMisclassification(
  stored: string | null | undefined,
  classified: ClassificationResult,
): { mismatch: boolean; reason?: string; severity?: "info" | "warning" } {
  if (!stored) return { mismatch: true, reason: "missing-category", severity: "warning" };
  if (stored === classified.slug) return { mismatch: false };

  // 'breaking-news' is intentionally allowed to sit on top of any section.
  if (stored === "breaking-news" || classified.slug === "breaking-news") return { mismatch: false };

  if (classified.confidence >= 0.75) {
    return { mismatch: true, reason: `stored=${stored} classified=${classified.slug}`, severity: "warning" };
  }
  return { mismatch: true, reason: `stored=${stored} low-confidence=${classified.confidence}`, severity: "info" };
}

/** Human-facing label used in alerts and the pipeline report. */
export function humanizeCategory(slug: string): string {
  return normalizeWhitespace(slug.replace(/-/g, " ")).replace(/\b\w/g, (c) => c.toUpperCase());
}
