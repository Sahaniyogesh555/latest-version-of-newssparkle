// Automatic SEO field generation and validation.
//
// Everything here is deterministic: given a draft it produces the slug, meta
// title, meta description, keywords and the schema-ready fields, and it
// *validates* them (length, keyword stuffing, clickbait, uniqueness) so a bad
// generation is corrected or rejected rather than published.

import { contentTokens, isStopword, normalizeWhitespace, truncateAtWord, wordCount } from "./text.ts";
import { isClickbait } from "./safety.ts";

export const SEO_LIMITS = {
  slug: 70,
  metaTitleMin: 45,
  metaTitleMax: 62,
  metaDescriptionMin: 120,
  metaDescriptionMax: 160,
  headlineMin: 35,
  headlineMax: 110,
  keywordsMin: 5,
  keywordsMax: 9,
  keywordDensityMax: 0.045,
};

export interface SlugOptions {
  maxLength?: number;
  /** Appended when a slug already exists (short, deterministic). */
  suffix?: string;
}

/** Readable, keyword-first slug. Never empty, never a bare year. */
export function buildSlug(title: string, options: SlugOptions = {}): string {
  const maxLength = options.maxLength ?? SEO_LIMITS.slug;
  const words = normalizeWhitespace(title.toLowerCase())
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const meaningful = words.filter((w) => !isStopword(w));
  const source = meaningful.length >= 3 ? meaningful : words;

  let slug = "";
  for (const word of source) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > maxLength) break;
    slug = next;
  }

  if (!slug) slug = "story";
  if (options.suffix) {
    const trimmed = slug.slice(0, Math.max(1, maxLength - options.suffix.length - 1));
    slug = `${trimmed}-${options.suffix}`;
  }
  return slug.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Guarantee uniqueness against slugs already in use. */
export function ensureUniqueSlug(slug: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(slug)) return slug;
  for (let i = 2; i <= 50; i++) {
    const candidate = `${slug}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export interface HeadlineValidation {
  ok: boolean;
  issues: string[];
}

/**
 * Trailing outlet name after a separator, e.g. "Rates held steady - BBC News".
 * Acronym bylines ("BBC", "NPR", "AP") are allowed in the tail.
 */
const PUBLISHER_SUFFIX = /\s[-–—|]\s(?:[A-Z][\w.&']*(?:\s+[A-Z][\w.&']*){0,3})$/;

/** Remove a trailing publisher byline so an otherwise good headline survives. */
export function stripPublisherSuffix(title: string): string {
  const clean = normalizeWhitespace(title);
  if (!PUBLISHER_SUFFIX.test(clean)) return clean;
  return normalizeWhitespace(clean.replace(PUBLISHER_SUFFIX, ""));
}

export function validateHeadline(title: string): HeadlineValidation {
  const issues: string[] = [];
  const clean = normalizeWhitespace(title);

  if (clean.length < SEO_LIMITS.headlineMin) issues.push("headline-too-short");
  if (clean.length > SEO_LIMITS.headlineMax) issues.push("headline-too-long");
  if (isClickbait(clean)) issues.push("headline-clickbait");
  if (PUBLISHER_SUFFIX.test(clean)) issues.push("headline-has-publisher-suffix");
  if (/:\s*$/.test(clean) || /\.\.\.$/.test(clean)) issues.push("headline-truncated");
  if (/\b(?:report|study|news|update)s?$/i.test(clean)) issues.push("headline-generic-tail");
  if (!/[a-z]/.test(clean)) issues.push("headline-no-lowercase");

  return { ok: issues.length === 0, issues };
}

export function validateMetaTitle(metaTitle: string): HeadlineValidation {
  const issues: string[] = [];
  const length = normalizeWhitespace(metaTitle).length;
  if (length < SEO_LIMITS.metaTitleMin) issues.push("meta-title-too-short");
  if (length > SEO_LIMITS.metaTitleMax) issues.push("meta-title-too-long");
  if (isClickbait(metaTitle)) issues.push("meta-title-clickbait");
  return { ok: issues.length === 0, issues };
}

export function validateMetaDescription(description: string): HeadlineValidation {
  const issues: string[] = [];
  const length = normalizeWhitespace(description).length;
  if (length < SEO_LIMITS.metaDescriptionMin) issues.push("meta-description-too-short");
  if (length > SEO_LIMITS.metaDescriptionMax) issues.push("meta-description-too-long");
  if (/^[a-z]/.test(description)) issues.push("meta-description-not-sentence-case");
  if (!/[.!?]$/.test(description.trim())) issues.push("meta-description-no-terminator");
  return { ok: issues.length === 0, issues };
}

/** Derive a compliant meta title from the headline when the model's is weak. */
export function buildMetaTitle(title: string, options: { brand?: string } = {}): string {
  const clean = normalizeWhitespace(title).replace(/\s[-–—|]\s.*$/, "");
  const brand = options.brand ? ` | ${options.brand}` : "";
  const budget = SEO_LIMITS.metaTitleMax - brand.length;
  return `${truncateAtWord(clean, budget, "")}${brand}`.trim();
}

export function buildMetaDescription(excerpt: string, options: { max?: number } = {}): string {
  const max = options.max ?? SEO_LIMITS.metaDescriptionMax;
  const clean = normalizeWhitespace(excerpt);
  if (clean.length < SEO_LIMITS.metaDescriptionMin) {
    return truncateAtWord(clean, max);
  }
  const sentenceEnd = clean.slice(0, max).match(/^.*[.!?]/);
  return sentenceEnd ? sentenceEnd[0] : truncateAtWord(clean, max);
}

/** Frequency-based keyword extraction with bigram support. */
export function extractKeywords(
  text: string,
  options: { limit?: number; seed?: string[] } = {},
): string[] {
  const limit = options.limit ?? SEO_LIMITS.keywordsMax;
  const tokens = contentTokens(text);
  const counts = new Map<string, number>();

  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  // Bigrams that repeat are usually the real subject ("interest rates").
  const bigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const phrase = `${tokens[i]} ${tokens[i + 1]}`;
    bigrams.set(phrase, (bigrams.get(phrase) ?? 0) + 1);
  }
  for (const [phrase, count] of bigrams) {
    if (count >= 2) counts.set(phrase, count * 1.5);
  }

  const seeded = (options.seed ?? [])
    .flatMap((s) => contentTokens(s))
    .filter((t) => t.length >= 3);

  const ranked = [...counts.entries()]
    .map(([term, count]) => ({ term, score: count + (seeded.includes(term) ? 2 : 0) }))
    .filter(({ term }) => term.length >= 3 || /\d/.test(term))
    .filter(({ term }) => !isStopword(term))
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));

  const chosen: string[] = [];
  for (const { term } of ranked) {
    if (chosen.length >= limit) break;
    // Skip unigrams already covered by a chosen bigram.
    if (!term.includes(" ") && chosen.some((c) => c.includes(" ") && c.includes(term))) continue;
    chosen.push(term);
  }
  return chosen;
}

/** Keyword density for the primary keyword — guards against stuffing. */
export function keywordDensity(text: string, keyword: string): number {
  const total = wordCount(text);
  if (total === 0 || !keyword) return 0;
  const occurrences = normalizeWhitespace(text.toLowerCase()).split(keyword.toLowerCase()).length - 1;
  const keywordWords = wordCount(keyword);
  return Number(((occurrences * keywordWords) / total).toFixed(4));
}

export function validateKeywordUsage(
  text: string,
  keywords: string[],
): { ok: boolean; primary?: string; density?: number; issues: string[] } {
  const issues: string[] = [];
  if (keywords.length < SEO_LIMITS.keywordsMin) issues.push("too-few-keywords");
  if (keywords.length > SEO_LIMITS.keywordsMax) issues.push("too-many-keywords");

  const primary = keywords[0];
  if (!primary) return { ok: false, issues: [...issues, "no-keywords"] };

  const density = keywordDensity(text, primary);
  if (density > SEO_LIMITS.keywordDensityMax) issues.push("keyword-stuffing");

  const haystack = text.toLowerCase();
  if (!haystack.includes(primary.toLowerCase())) issues.push("primary-keyword-absent");

  const duplicates = keywords.length - new Set(keywords.map((k) => k.toLowerCase())).size;
  if (duplicates > 0) issues.push("duplicate-keywords");

  return { ok: issues.length === 0, primary, density, issues };
}

/** Words the newsroom uses instead of shouting. */
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bslam(?:s|med)?\b/gi, "criticises"],
  [/\bblasts?\b/gi, "criticises"],
  [/\bslams?\b/gi, "criticises"],
  [/\brockets?\b/gi, "rises"],
  [/\bplunges?\b/gi, "falls"],
  [/\bskyrockets?\b/gi, "rises sharply"],
  [/\bexplodes?\b/gi, "grows rapidly"],
  [/\bdestroys?\b/gi, "defeats"],
];

/** Tone normaliser: removes tabloid verbs from AI output. */
export function deHype(text: string): string {
  return REPLACEMENTS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

export interface SeoBundle {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  excerpt: string;
}

export interface SeoIssueSet {
  ok: boolean;
  issues: string[];
}

/**
 * Fix up and validate a model-generated SEO bundle in one pass.
 * Returns the corrected bundle plus every issue that was found, so the caller
 * can decide between publishing, review and rejection.
 */
export function prepareSeoBundle(
  input: {
    title: string;
    excerpt: string;
    content: string;
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  },
  options: { brand?: string; takenSlugs?: Iterable<string>; keywordsSeed?: string[] } = {},
): { bundle: SeoBundle; validation: SeoIssueSet } {
  const issues: string[] = [];

  const headline = validateHeadline(input.title);
  issues.push(...headline.issues);

  const slug = ensureUniqueSlug(buildSlug(input.title), options.takenSlugs ?? []);

  let metaTitle = normalizeWhitespace(input.metaTitle ?? "");
  if (!metaTitle || !validateMetaTitle(metaTitle).ok) {
    if (metaTitle) issues.push(...validateMetaTitle(metaTitle).issues.map((i) => `generated:${i}`));
    metaTitle = buildMetaTitle(input.title, { brand: options.brand });
  }

  let metaDescription = normalizeWhitespace(input.metaDescription ?? "");
  if (!metaDescription || !validateMetaDescription(metaDescription).ok) {
    if (metaDescription) {
      issues.push(...validateMetaDescription(metaDescription).issues.map((i) => `generated:${i}`));
    }
    metaDescription = buildMetaDescription(input.excerpt);
  }

  const keywords =
    input.keywords && input.keywords.length >= SEO_LIMITS.keywordsMin
      ? [...new Set(input.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(
          0,
          SEO_LIMITS.keywordsMax,
        )
      : extractKeywords(
          `${input.title} ${input.excerpt} ${input.content.slice(0, 1500)}`,
          { seed: options.keywordsSeed },
        );

  const keywordUsage = validateKeywordUsage(
    `${input.title} ${input.excerpt} ${input.content}`,
    keywords,
  );
  issues.push(...keywordUsage.issues);

  return {
    bundle: {
      slug,
      metaTitle,
      metaDescription,
      keywords,
      excerpt: truncateAtWord(input.excerpt, 320),
    },
    validation: { ok: issues.length === 0, issues },
  };
}

/** JSON-LD fragments the front end spreads into its NewsArticle schema. */
export function buildSchemaFields(input: {
  title: string;
  description: string;
  category: string;
  keywords: string[];
  imageUrl?: string | null;
  imageAlt?: string | null;
}): Record<string, unknown> {
  return {
    headline: input.title,
    description: input.description,
    articleSection: input.category,
    keywords: input.keywords.join(", "),
    ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
    ...(input.imageAlt ? { thumbnailAlt: input.imageAlt } : {}),
  };
}
