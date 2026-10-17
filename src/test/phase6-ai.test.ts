/**
 * Phase 6 — AI layer: prompt building, response parsing and failure behaviour,
 * replayed against recorded model responses (no network involved).
 */
import { describe, it, expect, vi } from "vitest";
import {
  AiUnavailableError,
  SYSTEM_WRITER,
  buildAltTextPrompt,
  buildHeadlinePrompt,
  buildVerifierPrompt,
  buildWriterPrompt,
  chat,
  estimateTokens,
  formatSources,
  parseAltText,
  parseHeadlineAlternatives,
  parseJsonObject,
  parseVerifierResponse,
  parseWriterDraft,
  sourcesToFacts,
  type AiConfig,
} from "../../supabase/functions/_shared/ai.ts";
import { evaluateQuality } from "../../supabase/functions/_shared/quality.ts";
import { classifyCategory } from "../../supabase/functions/_shared/classify.ts";
import { prepareSeoBundle } from "../../supabase/functions/_shared/seo.ts";
import {
  ALT_TEXT,
  WRITER_SHORT,
  FIXTURE_SOURCES,
  HEADLINES,
  VERIFIER_GARBAGE,
  VERIFIER_REJECTED,
  VERIFIER_SUPPORTED,
  WRITER_FENCED,
  WRITER_GOOD,
  WRITER_TRUNCATED,
  WRITER_UNPARSEABLE,
  WRITER_UNSUPPORTED_FIGURE,
} from "./fixtures/ai-responses.ts";

const config: AiConfig = { apiKey: "test-key", baseUrl: "https://api.example.com/v1", model: "gpt-4o-mini" };

describe("prompt building", () => {
  it("briefs the writer with sources, length, structure and JSON contract", () => {
    const prompt = buildWriterPrompt({
      edition: "midday",
      category: "business",
      angle: "midday explainer",
      targetWords: 620,
      sources: FIXTURE_SOURCES,
      titleHint: "Energy prices rise again",
      avoidHeadlines: ["Energy prices rise again"],
      contextHeadlines: ["Regulator warns on standing charges"],
    });
    expect(prompt).toContain("620-word");
    expect(prompt).toContain("business");
    expect(prompt).toContain("[1] BBC World");
    expect(prompt).toContain("REQUIREMENTS");
    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain("Do not quote more than six consecutive words");
    expect(prompt).toContain("do not reuse these angles");
    expect(prompt).toContain("RECENT COVERAGE IN THIS SECTION");
  });

  it("always states the no-copying and no-fabrication rules", () => {
    expect(SYSTEM_WRITER).toContain("never invent");
    expect(SYSTEM_WRITER).toContain("rewritten in your own words");
    const prompt = buildWriterPrompt({ edition: "morning", category: "world", angle: "brief", targetWords: 320, sources: FIXTURE_SOURCES });
    expect(prompt).toContain("No clickbait");
    expect(prompt).toContain("Every figure, name and date must come from the source material");
  });

  it("formats sources compactly and lists only sourced figures as available facts", () => {
    const formatted = formatSources(FIXTURE_SOURCES);
    expect(formatted.split("\n").length).toBeLessThan(12);
    expect(formatted).toContain("Reuters");

    const facts = sourcesToFacts(FIXTURE_SOURCES);
    expect(facts).toContain("12%");
    expect(facts.some((f) => f.includes("180"))).toBe(true);
    expect(facts).not.toContain("47%");
  });

  it("builds verification, headline and alt-text prompts", () => {
    const verifier = buildVerifierPrompt("Draft body text", FIXTURE_SOURCES);
    expect(verifier).toContain("SOURCE MATERIAL:");
    expect(verifier).toContain('"supported"');

    const headline = buildHeadlinePrompt("Body", "business", ["Old headline"]);
    expect(headline).toContain("business");
    expect(headline).toContain("Old headline");

    expect(buildAltTextPrompt("Energy prices rise 12%", "business")).toContain("max 125 characters");
  });
});

describe("response parsing", () => {
  it("extracts JSON from fences and surrounding prose", () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
    expect(parseJsonObject("no json here")).toBeNull();
    expect(parseJsonObject("[1,2,3]")).toBeNull();
    expect(parseJsonObject("")).toBeNull();
  });

  it("parses a good writer response into a draft", () => {
    const draft = parseWriterDraft(WRITER_GOOD.response);
    expect(draft).not.toBeNull();
    expect(draft?.title).toContain("Energy regulator");
    expect(draft?.content).toContain("## Why it matters");
    expect(draft?.keyTakeaways?.length).toBe(3);
    expect(draft?.faq?.length).toBe(3);
  });

  it("parses the same shape when the model fences it and adds chatter", () => {
    const draft = parseWriterDraft(WRITER_FENCED.response);
    expect(draft?.title).toBe("Central bank holds benchmark rate for a third meeting");
    expect(draft?.content).toContain("### What analysts say");
  });

  it("rejects unusable model output instead of guessing", () => {
    expect(parseWriterDraft(WRITER_UNPARSEABLE.response)).toBeNull();
    expect(parseWriterDraft("{}")).toBeNull();
    expect(parseWriterDraft('{"title":"too short","content":"tiny"}')).toBeNull();
  });

  it("fails verification closed on an unparseable verdict", () => {
    const good = parseVerifierResponse(VERIFIER_SUPPORTED.response);
    expect(good.supported).toBe(true);
    expect(good.confidence).toBeCloseTo(0.86, 2);

    const rejected = parseVerifierResponse(VERIFIER_REJECTED.response);
    expect(rejected.supported).toBe(false);
    expect(rejected.unsupportedClaims).toHaveLength(2);

    const garbage = parseVerifierResponse(VERIFIER_GARBAGE.response);
    expect(garbage.supported).toBe(false);
    expect(garbage.confidence).toBe(0);
    expect(garbage.notes).toBe("unparseable verdict");
  });

  it("parses headlines and alt text with fallbacks", () => {
    expect(parseHeadlineAlternatives(HEADLINES.response, "fallback")).toHaveLength(3);
    expect(parseHeadlineAlternatives("nonsense", "fallback")).toEqual(["fallback"]);
    expect(parseAltText(ALT_TEXT.response, "fallback")).toContain("gas meter");
    expect(parseAltText("nonsense", "fallback")).toBe("fallback");
  });

  it("estimates tokens without a provider", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("x".repeat(400))).toBe(100);
  });
});

describe("pipeline reaction to recorded model output", () => {
  const qualityInput = (raw: string, targetWords = 320) => {
    const draft = parseWriterDraft(raw);
    if (!draft) return null;
    const classification = classifyCategory({ title: draft.title, sourceHint: "business" });
    const { bundle } = prepareSeoBundle(
      {
        title: draft.title,
        excerpt: draft.excerpt,
        content: draft.content,
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        keywords: draft.keywords,
      },
      { brand: "NewsSparkle" },
    );
    return evaluateQuality({
      ...draft,
      metaTitle: bundle.metaTitle,
      metaDescription: bundle.metaDescription,
      keywords: bundle.keywords,
      targetWords,
      sources: FIXTURE_SOURCES,
      classification,
    });
  };

  it("sends a clean, sourced draft to publish", () => {
    const evaluation = qualityInput(WRITER_GOOD.response);
    expect(evaluation).not.toBeNull();
    expect(evaluation?.report.verdict).toBe("publish");
    expect(evaluation?.report.score).toBeGreaterThanOrEqual(75);
  });

  it("keeps a fenced draft publishable for a shorter brief", () => {
    const evaluation = qualityInput(WRITER_FENCED.response, 220);
    expect(evaluation?.report.verdict).not.toBe("reject");
    expect(evaluation?.report.blockingReasons).toEqual([]);
  });

  it("refuses a body that is unusably short before it ever reaches the scorer", () => {
    expect(parseWriterDraft(WRITER_TRUNCATED.response)).toBeNull();
  });

  it("rejects a parseable but truncated draft against its brief", () => {
    const evaluation = qualityInput(WRITER_SHORT.response, 620);
    expect(evaluation?.report.verdict).toBe("reject");
    expect(evaluation?.report.blockingReasons.join(" ")).toContain("completeness");
  });

  it("rejects a draft whose figures contradict the sources", () => {
    const evaluation = qualityInput(WRITER_UNSUPPORTED_FIGURE.response, 320);
    expect(evaluation?.report.verdict).toBe("reject");
    expect(evaluation?.report.blockingReasons.join(" ")).toContain("factual");
  });

  it("drops the whole candidate when the model returns nonsense", () => {
    expect(qualityInput(WRITER_UNPARSEABLE.response)).toBeNull();
  });

  it("forces a review verdict when the verifier cannot confirm the claims", () => {
    const draft = parseWriterDraft(WRITER_GOOD.response);
    const verdict = parseVerifierResponse(VERIFIER_REJECTED.response);
    const evaluation = evaluateQuality({
      ...draft!,
      targetWords: 320,
      sources: FIXTURE_SOURCES,
      verification: { modelSupported: verdict.supported, modelConfidence: verdict.confidence, modelNotes: verdict.notes },
    });
    // Held for a human rather than discarded: the draft is never published, but
    // an unconfirmed verdict alone is not proof of fabrication.
    expect(evaluation.report.verdict).toBe("review");
    expect(evaluation.report.reviewReasons.join(" ")).toContain("verification");
    expect(evaluation.report.blockingReasons).toEqual([]);
  });
});

describe("AI transport", () => {
  it("returns text and token usage on success", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: [{ message: { content: WRITER_GOOD.response } }],
          usage: { prompt_tokens: 900, completion_tokens: 700 },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await chat(config, { system: SYSTEM_WRITER, user: "write", fetchImpl });
    expect(result.promptTokens).toBe(900);
    expect(result.completionTokens).toBe(700);
    const body = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].role).toBe("system");
  });

  it("does not retry an authorisation failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad key", { status: 401 })) as unknown as typeof fetch;
    await expect(chat(config, { system: "s", user: "u", fetchImpl, attempts: 3 })).rejects.toThrow(AiUnavailableError);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("retries a provider outage and gives up without producing content", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response("upstream down", { status: 503 });
    }) as unknown as typeof fetch;
    await expect(chat(config, { system: "s", user: "u", fetchImpl, attempts: 2 })).rejects.toThrow();
    expect(calls).toBe(2);
  });

  it("treats an empty completion as a failure", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "   " } }] }), { status: 200 })) as unknown as typeof fetch;
    await expect(chat(config, { system: "s", user: "u", fetchImpl, attempts: 1 })).rejects.toThrow(/empty completion/);
  });
});
