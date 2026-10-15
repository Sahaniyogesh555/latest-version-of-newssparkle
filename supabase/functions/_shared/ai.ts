// AI gateway for the newsroom.
//
// Everything model-related goes through here so the pipeline has one place to
// control cost, retries, timeouts and failure behaviour. Two rules:
//
//   1. Prompt building and response parsing are pure functions. They live in
//      this file, are covered by tests, and change only deliberately.
//   2. The network call is a thin wrapper around the OpenAI-compatible chat
//      completions endpoint used by the project's existing AI provider config.
//
// If the model is unavailable, callers get a typed failure — never a fabricated
// article. `writeDesk` turns that into a deferred candidate plus an alert.

import { withRetry, HttpError, RetryExhaustedError, isRetryableStatus } from "./retry.ts";
import { extractNumbers, wordCount } from "./text.ts";
import type { Edition, SourceFeedItem } from "./types.ts";

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** Read AI settings from the function environment. */
export function aiConfigFromEnv(getenv: (key: string) => string | undefined): AiConfig | null {
  const apiKey = getenv("OPENAI_API_KEY") ?? getenv("AI_API_KEY") ?? getenv("LOVABLE_API_KEY");
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (getenv("AI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: getenv("AI_MODEL") ?? "gpt-4o-mini",
  };
}

/* -------------------------------------------------------------------------- */
/* Prompt building (pure)                                                     */
/* -------------------------------------------------------------------------- */

export interface WriterBrief {
  edition: Edition;
  category: string;
  angle: string;
  targetWords: number;
  sources: SourceFeedItem[];
  titleHint?: string;
  /** Existing published headlines, so the writer avoids near-duplicates. */
  avoidHeadlines?: string[];
  /** Recent stories in this category, for continuity and angle variety. */
  contextHeadlines?: string[];
}

export const SYSTEM_WRITER =
  "You are a careful newsroom editor. You write original, factual copy from supplied source material only. " +
  "You never invent quotes, figures, names, dates or events. " +
  "If the source material is too thin for a claim, you leave the claim out. " +
  "You write plain, specific, jargon-free English for a general audience. " +
  "You never copy sentences from the source material: everything is rewritten in your own words.";

/** Compact source digest — the only facts the model is allowed to use. */
export function formatSources(sources: SourceFeedItem[]): string {
  return sources
    .map((source, index) => {
      const when = source.published ? ` (${source.published})` : "";
      const snippet = source.snippet ? `\n   ${source.snippet.slice(0, 900)}` : "";
      return `[${index + 1}] ${source.sourceName}${when}: ${source.title}${snippet}`;
    })
    .join("\n");
}

export function buildWriterPrompt(brief: WriterBrief): string {
  const facts = sourcesToFacts(brief.sources);
  const lines = [
    `Write a ${brief.targetWords}-word news article for the "${brief.category}" section.`,
    `Angle: ${brief.angle}.`,
    "",
    "SOURCE MATERIAL (facts you may use, in your own words):",
    formatSources(brief.sources),
    "",
    `FACTS AVAILABLE TO YOU: ${facts.length > 0 ? facts.join("; ") : "no hard figures supplied"}`,
    "",
    "REQUIREMENTS",
    `- Length: ${brief.targetWords} words (+/- 15%).`,
    "- Structure: an opening paragraph that states what happened, then at least two `##` sections",
    "  (for example `## Why it matters` and `## What to watch`), one `###` subsection, and a closing paragraph.",
    "- Every figure, name and date must come from the source material above.",
    "- Attribute facts to the outlet by name where it helps the reader judge the sourcing.",
    "- No clickbait, no rhetorical questions in the headline, no first-person voice, no advice to readers.",
    "- Do not quote more than six consecutive words from any source.",
  ];

  if (brief.titleHint) lines.push(`- Working headline to improve on: ${brief.titleHint}`);
  if (brief.avoidHeadlines?.length) {
    lines.push(
      "",
      "ALREADY PUBLISHED — do not reuse these angles or headlines:",
      ...brief.avoidHeadlines.slice(0, 12).map((headline) => `- ${headline}`),
    );
  }
  if (brief.contextHeadlines?.length) {
    lines.push("", "RECENT COVERAGE IN THIS SECTION (for continuity):", ...brief.contextHeadlines.slice(0, 6).map((h) => `- ${h}`));
  }

  lines.push(
    "",
    "Return JSON only, with this shape:",
    '{"title": "...", "excerpt": "...", "content": "markdown body", "keyTakeaways": ["...", "...", "..."],',
    ' "faq": [{"q": "...", "a": "..."}], "metaTitle": "...", "metaDescription": "...", "keywords": ["...", "..."]}',
    "The excerpt is one sentence of 120-160 characters. metaTitle is at most 62 characters.",
  );

  return lines.join("\n");
}

/** Pull the checkable claims (figures) out of the source material. */
export function sourcesToFacts(sources: SourceFeedItem[]): string[] {
  const numbers = sources.flatMap((source) => extractNumbers(`${source.title} ${source.snippet ?? ""}`));
  return [...new Set(numbers)].slice(0, 40);
}

export const SYSTEM_VERIFIER =
  "You are a fact-checking editor. You compare a draft article against the source material and report only " +
  "problems you can point to. You do not rewrite the article. You answer with JSON only.";

export function buildVerifierPrompt(draft: string, sources: SourceFeedItem[]): string {
  return [
    "SOURCE MATERIAL:",
    formatSources(sources),
    "",
    "DRAFT:",
    draft.slice(0, 12_000),
    "",
    "Check the draft against the source material only.",
    "Return JSON:",
    '{"supported": true|false, "confidence": 0-1, "unsupportedClaims": ["..."], "contradictions": ["..."], "notes": "..."}',
    "- supported=false if the draft states any fact, figure, name, date or event that the sources do not support,",
    "  or contradicts them, or if it reports an allegation as established fact.",
    "- confidence is your honest confidence in this verdict.",
  ].join("\n");
}

export const SYSTEM_HEADLINE =
  "You are a headline editor. You write accurate, specific, non-clickbait headlines. JSON only.";

export function buildHeadlinePrompt(article: string, category: string, avoid: string[] = []): string {
  return [
    `Write 3 alternative headlines (35-100 characters) for this ${category} article.`,
    "Each must be factual and specific, name the actor and the action, and avoid hype, questions and colons.",
    avoid.length > 0 ? `Do not resemble: ${avoid.slice(0, 8).join(" | ")}` : "",
    "",
    "ARTICLE:",
    article.slice(0, 6_000),
    "",
    'Return JSON: {"headlines": ["...", "...", "..."]}',
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export const SYSTEM_IMAGE_ALT =
  "You describe news photographs for screen readers. You describe what is visible, never what you assume. JSON only.";

export function buildAltTextPrompt(headline: string, section: string): string {
  return [
    `Write alt text (max 125 characters) for the lead image of this ${section} story.`,
    "Describe the scene a photographer would plausibly have captured for the story. No text overlays, no names you cannot know.",
    `Headline: ${headline}`,
    'Return JSON: {"alt": "..."}',
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* Draft parsing (pure)                                                       */
/* -------------------------------------------------------------------------- */

export interface WriterDraft {
  title: string;
  excerpt: string;
  content: string;
  keyTakeaways?: string[];
  faq?: Array<{ q: string; a: string }>;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
}

/** Tolerate ```json fences and stray prose around the JSON object. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  if (typeof raw !== "string") return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown, limit: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, limit);
  return out.length > 0 ? out : undefined;
}

/** Validate and normalise a writer response. Returns null when unusable. */
export function parseWriterDraft(raw: string): WriterDraft | null {
  const parsed = parseJsonObject(raw);
  if (!parsed) return null;

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  if (title.length < 15 || wordCount(content) < 80) return null;

  const excerptRaw = typeof parsed.excerpt === "string" ? parsed.excerpt.trim() : "";
  const faq = Array.isArray(parsed.faq)
    ? parsed.faq
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({ q: String(item.q ?? "").trim(), a: String(item.a ?? "").trim() }))
        .filter((item) => item.q.length > 3 && item.a.length > 10)
        .slice(0, 5)
    : undefined;

  return {
    title,
    // A short or missing excerpt is regenerated by the SEO module; never invented here.
    excerpt: excerptRaw.slice(0, 300),
    content,
    keyTakeaways: asStringArray(parsed.keyTakeaways, 5),
    faq: faq && faq.length > 0 ? faq : undefined,
    metaTitle: typeof parsed.metaTitle === "string" ? parsed.metaTitle.trim() : undefined,
    metaDescription: typeof parsed.metaDescription === "string" ? parsed.metaDescription.trim() : undefined,
    keywords: asStringArray(parsed.keywords, 10),
  };
}

export interface VerificationResult {
  supported: boolean;
  confidence: number;
  unsupportedClaims: string[];
  contradictions: string[];
  notes: string;
}

/** Fail closed: an unparseable verification response is treated as unsupported. */
export function parseVerifierResponse(raw: string): VerificationResult {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return { supported: false, confidence: 0, unsupportedClaims: [], contradictions: [], notes: "unparseable verdict" };
  }
  const confidenceRaw = Number(parsed.confidence);
  return {
    supported: parsed.supported === true,
    confidence: Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0,
    unsupportedClaims: asStringArray(parsed.unsupportedClaims, 10) ?? [],
    contradictions: asStringArray(parsed.contradictions, 10) ?? [],
    notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 500) : "",
  };
}

export function parseHeadlineAlternatives(raw: string, fallback: string): string[] {
  const parsed = parseJsonObject(raw);
  const headlines = asStringArray(parsed?.headlines, 3) ?? [];
  return headlines.length > 0 ? headlines : [fallback];
}

export function parseAltText(raw: string, fallback: string): string {
  const parsed = parseJsonObject(raw);
  const alt = typeof parsed?.alt === "string" ? parsed.alt.trim() : "";
  return alt.length >= 10 ? alt.slice(0, 125) : fallback;
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

export interface ChatOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider for strict JSON output. */
  json?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Retry attempts for transient provider failures. */
  attempts?: number;
}

export interface ChatResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export class AiUnavailableError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Chat completion with timeout, bounded retries and token accounting.
 * Throws AiUnavailableError on 401/402/429-after-retries/5xx — callers must
 * treat that as "no article today", never as "invent something".
 */
export async function chat(
  config: AiConfig,
  options: ChatOptions,
): Promise<ChatResult> {
  const {
    system,
    user,
    maxTokens = 2_400,
    temperature = 0.6,
    json = true,
    timeoutMs = 90_000,
    fetchImpl = fetch,
    attempts = 3,
  } = options;

  const body = {
    model: config.model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(json ? { response_format: { type: "json_object" } } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await withRetry(
      async () => {
        const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          // 401/402/403 are configuration problems: retrying wastes budget.
          if (response.status === 401 || response.status === 402 || response.status === 403) {
            throw new AiUnavailableError(`AI provider rejected the request (${response.status})`, response.status);
          }
          throw new HttpError(response.status, `${config.baseUrl}/chat/completions`, detail);
        }

        const payload = (await response.json()) as {
          model?: string;
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const text = payload.choices?.[0]?.message?.content ?? "";
        if (!text.trim()) throw new HttpError(502, "empty completion", "provider returned no content");

        return {
          text,
          model: payload.model ?? config.model,
          promptTokens: payload.usage?.prompt_tokens ?? estimateTokens(system + user),
          completionTokens: payload.usage?.completion_tokens ?? estimateTokens(text),
        };
      },
      {
        attempts,
        seed: "ai:chat",
        shouldRetry: (error) => {
          if (error instanceof AiUnavailableError) return false;
          if (error instanceof HttpError) return isRetryableStatus(error.status);
          return true;
        },
      },
    );
  } catch (error) {
    // One typed failure for callers: the pipeline must not need to know how
    // the retry layer wrapped things.
    const cause = error instanceof RetryExhaustedError ? error.lastError : error;
    if (cause instanceof AiUnavailableError) throw cause;
    const status = cause instanceof HttpError ? cause.status : undefined;
    throw new AiUnavailableError(cause instanceof Error ? cause.message : "AI request failed", status);
  } finally {
    clearTimeout(timer);
  }
}
