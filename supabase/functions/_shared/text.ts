// Text utilities used across the newsroom pipeline.
// Pure functions only — no Deno, no network — so they are unit testable.

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from",
  "had", "has", "have", "he", "her", "his", "how", "i", "in", "into", "is", "it",
  "its", "just", "may", "more", "most", "new", "no", "not", "of", "on", "or",
  "our", "out", "over", "said", "says", "she", "so", "some", "than", "that",
  "the", "their", "them", "then", "there", "these", "they", "this", "to", "up",
  "was", "we", "were", "what", "when", "where", "which", "who", "will", "with",
  "would", "you", "your", "amid", "after", "before", "about", "also", "could",
  "should", "its", "it's", "amid", "via", "per", "vs", "—", "-",
]);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}

/** Decode the handful of HTML entities that appear in feed descriptions. */
export function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…",
    mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
    copy: "©", reg: "®", trade: "™", laquo: "«", raquo: "»", deg: "°",
  };
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[String(name).toLowerCase()] ?? match);
}

function safeCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/** Strip markup/CDATA, decode entities, collapse whitespace. */
export function stripHtml(input: unknown): string {
  if (typeof input !== "string") return "";
  return decodeEntities(
    input
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function wordCount(input: string): number {
  return normalizeWhitespace(input).split(" ").filter(Boolean).length;
}

export function splitSentences(input: string): string[] {
  return normalizeWhitespace(input)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function splitParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Rough English syllable count — good enough for a readability band. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch reading ease. Higher = easier. 60–70 is a good newsroom target. */
export function fleschReadingEase(text: string): number {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  if (words.length === 0) return 0;
  const sentences = Math.max(1, splitSentences(text).length);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Number(score.toFixed(1))));
}

export function averageSentenceLength(text: string): number {
  const words = wordCount(text);
  const sentences = Math.max(1, splitSentences(text).length);
  return Number((words / sentences).toFixed(1));
}

/**
 * Language sanity check for the "English only" publishing rule.
 * Rejects feeds/items dominated by non-Latin script or lacking English
 * function words — deliberately permissive so short headlines pass.
 */
export function looksEnglish(text: string): boolean {
  const sample = normalizeWhitespace(text);
  if (sample.length < 12) return true;

  const letters = sample.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return false;

  const latin = sample.replace(/[^A-Za-z]/g, "").length;
  const latinRatio = latin / letters.length;
  if (latinRatio < 0.75) return false;

  const words = sample.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 6) return true;

  const englishMarkers = new Set([
    "the", "a", "an", "of", "to", "in", "and", "for", "on", "with", "is", "are",
    "was", "were", "as", "by", "at", "from", "that", "this", "it", "has", "have",
  ]);
  const hits = words.filter((w) => englishMarkers.has(w.replace(/[^a-z]/g, ""))).length;
  return hits / words.length >= 0.04;
}

export function truncateAtWord(text: string, maxLength: number, ellipsis = "…"): string {
  const clean = normalizeWhitespace(text);
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - ellipsis.length);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}${ellipsis}`;
}

const UNIT = "(?:%|percent|per cent|bn|billion|million|trillion|thousand|km|kg|mph|kph|degrees?|°c|°f|jobs|people|homes|cases|deaths)";

/**
 * Numbers, money, percentages and years — the tokens a fact check cares about.
 * Deliberately not anchored with \b after symbols (a boundary needs a word
 * character on one side, so "12%" at a space would never match).
 */
export function extractNumbers(text: string): string[] {
  const patterns = [
    /[$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:billion|million|trillion|bn|m))?/gi,
    new RegExp(`\\d[\\d,]*(?:\\.\\d+)?\\s?${UNIT}`, "gi"),
    /\b(?:19|20)\d{2}\b/g,
    /\b\d[\d,]{3,}\b/g,
    /\b\d+(?:\.\d+)?\b/g,
  ];
  const found = patterns.flatMap((pattern) => normalizeWhitespace(text).match(pattern) ?? []);
  const cleaned = found.map((m) => m.trim()).filter((m) => m.length > 0);
  // Longest match wins so "$1.2 billion" is not also reported as "1".
  const unique = [...new Set(cleaned)].sort((a, b) => b.length - a.length);
  return unique.filter((candidate) => !unique.some((other) => other !== candidate && other.includes(candidate)));
}

/**
 * Light English stemmer for headline comparison — irregular news verb forms
 * plus common suffixes. Only used for similarity, never for display.
 */
const IRREGULAR_STEMS: Record<string, string> = {
  held: "hold", holds: "hold", holding: "hold",
  kept: "keep", keeps: "keep", keeping: "keep",
  rose: "rise", rises: "rise", rising: "rise", risen: "rise",
  fell: "fall", falls: "fall", falling: "fall", fallen: "fall",
  said: "say", says: "say", saying: "say",
  cut: "cut", cuts: "cut", cutting: "cut", slashed: "cut", slashes: "cut",
  won: "win", wins: "win", winning: "win",
  lost: "lose", loses: "lose", losing: "lose",
  grew: "grow", grows: "grow", growing: "grow", grown: "grow",
  banned: "ban", bans: "ban", banning: "ban",
  died: "die", dies: "die", dying: "die", deaths: "death",
  approved: "approve", approves: "approve", approving: "approve",
  passed: "pass", passes: "pass", passing: "pass",
};

export function stem(word: string): string {
  const lower = word.toLowerCase();
  if (IRREGULAR_STEMS[lower]) return IRREGULAR_STEMS[lower];
  if (lower.length <= 4) return lower;
  return lower
    .replace(/(?:ies)$/, "y")
    .replace(/(?:sses)$/, "ss")
    .replace(/(?:ses|zes|ches|shes)$/, "s")
    .replace(/(?:ing|ed)$/, "")
    .replace(/(?:s)$/, "");
}

/** Capitalised multi-word phrases — a cheap proxy for named entities. */
export function extractEntities(text: string, limit = 40): string[] {
  const candidates = normalizeWhitespace(text).match(
    /\b(?:[A-Z][a-z’'-]{2,})(?:\s+(?:of|the|and|for|de|van|al)?\s*[A-Z][a-z’'-]{2,}){1,3}\b/g,
  );
  const out: string[] = [];
  for (const candidate of candidates ?? []) {
    // Drop leading determiners so "The European Central Bank" is indexed as
    // "European Central Bank" and matches across variations.
    const value = candidate.trim().replace(/^(?:The|A|An)\s+/, "");
    if (value.split(" ").length < 2) continue;
    if (out.some((existing) => existing.toLowerCase() === value.toLowerCase())) continue;
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

/** Content tokens: lowercased, stopword-free, length ≥ 3. */
export function contentTokens(text: string): string[] {
  return normalizeWhitespace(text.toLowerCase())
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    // Tokens shorter than three characters are usually noise, but numbers are
    // signal: "90" homes, "12" deaths, "AI" style short words are kept when
    // they carry a digit.
    .filter((w) => (w.length >= 3 || /\d/.test(w)) && !isStopword(w));
}

/** Stem a token list — used for similarity only, never for display. */
export function stemTokens(tokens: string[]): string[] {
  return tokens.map(stem);
}

export function uniqueContentTokens(text: string): string[] {
  return [...new Set(contentTokens(text))];
}

export function readingTimeMinutes(words: number): number {
  return Math.max(1, Math.round(words / 225));
}

/** Deterministic 64-bit FNV-1a hash, returned as 16 hex chars. */
export function hash64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = (1n << 64n) - 1n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}
