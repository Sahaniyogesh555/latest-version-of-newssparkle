/**
 * Phase 6 — content intelligence: text metrics, duplicate detection,
 * classification and SEO generation/validation.
 */
import { describe, it, expect } from "vitest";
import {
  contentTokens,
  extractEntities,
  extractNumbers,
  fleschReadingEase,
  hash64,
  looksEnglish,
  stripHtml,
  truncateAtWord,
  wordCount,
} from "../../supabase/functions/_shared/text.ts";
import {
  dedupeBatch,
  duplicationRisk,
  findDuplicate,
  fingerprint,
  normalizeHeadline,
  contentSimilarity,
  simhash,
  simhashSimilarity,
  titleSimilarity,
} from "../../supabase/functions/_shared/dedupe.ts";
import { classifyCategory, detectMisclassification } from "../../supabase/functions/_shared/classify.ts";
import {
  buildMetaDescription,
  buildMetaTitle,
  buildSlug,
  ensureUniqueSlug,
  extractKeywords,
  keywordDensity,
  prepareSeoBundle,
  validateHeadline,
  validateKeywordUsage,
} from "../../supabase/functions/_shared/seo.ts";

describe("text utilities", () => {
  it("strips markup, CDATA and entities", () => {
    expect(stripHtml("<![CDATA[<p>Hello &amp; welcome</p>]]>")).toBe("Hello & welcome");
    expect(stripHtml("<p>Rates <b>held</b> steady</p>")).toBe("Rates held steady");
    expect(stripHtml(undefined)).toBe("");
  });

  it("counts words and truncates on word boundaries", () => {
    expect(wordCount("one two three")).toBe(3);
    expect(truncateAtWord("the quick brown fox jumps", 12)).toBe("the quick…");
  });

  it("scores readability inside a sensible band", () => {
    const easy = fleschReadingEase(
      "The bank held rates. It said prices are cooling. Borrowers will pay the same.",
    );
    const hard = fleschReadingEase(
      "Notwithstanding the aforementioned macroeconomic considerations, the institution's " +
        "deliberations culminated in the maintenance of the prevailing benchmark, " +
        "necessitating recalibration of fiscal assumptions.",
    );
    expect(easy).toBeGreaterThan(hard);
    expect(easy).toBeGreaterThan(40);
    expect(hard).toBeLessThan(30);
  });

  it("detects non-English text and passes English", () => {
    expect(looksEnglish("The central bank held interest rates steady for a third meeting")).toBe(true);
    expect(looksEnglish("केन्द्रीय बैंक ने ब्याज दरें स्थिर रखीं और बाजार में उतार चढ़ाव देखा गया")).toBe(false);
    expect(looksEnglish("Правительство объявило о новых мерах в экономике сегодня утром")).toBe(false);
  });

  it("extracts the figures worth fact-checking and named references", () => {
    const numbers = extractNumbers("Revenue rose 12% to $1.2 billion in 2026, up 4,500 jobs.");
    expect(numbers.some((n) => /12\s?%/.test(n))).toBe(true);
    expect(numbers.some((n) => /1\.2 billion/i.test(n))).toBe(true);
    expect(numbers).toContain("2026");
    expect(extractEntities("The European Central Bank met in Frankfurt with Chancellor Meyer")).toEqual(
      expect.arrayContaining(["European Central Bank"]),
    );
  });

  it("produces content tokens without stopwords", () => {
    expect(contentTokens("The Bank of England held the rate")).toEqual(["bank", "england", "held", "rate"]);
  });

  it("hashes deterministically", () => {
    expect(hash64("stable input")).toBe(hash64("stable input"));
    expect(hash64("stable input")).not.toBe(hash64("different input"));
  });
});

describe("duplicate detection", () => {
  it("normalises publisher suffixes out of headlines", () => {
    expect(normalizeHeadline("Central bank holds rates steady - BBC News")).toBe("central bank holds rates steady");
    expect(normalizeHeadline("LIVE: Storm hits the coast (video)")).toBe("storm hits the coast");
  });

  it("fingerprints reordered headlines identically", () => {
    expect(fingerprint("Bank holds rates steady")).toBe(fingerprint("Rates steady as bank holds"));
  });

  it("scores similar headlines above unrelated ones", () => {
    const close = titleSimilarity(
      "Central bank holds interest rates steady",
      "Central bank keeps interest rates unchanged",
    );
    const far = titleSimilarity(
      "Central bank holds interest rates steady",
      "Streaming service orders six half-hour dramas",
    );
    expect(close).toBeGreaterThan(0.55);
    expect(far).toBeLessThan(0.2);
  });

  it("separates reworded copy from independently written copy", () => {
    const original = [
      "The central bank left its benchmark rate unchanged for a third consecutive meeting, citing cooling inflation and a resilient labour market across the currency bloc.",
      "Officials said price growth was easing towards the two percent target while hiring remained firm, giving the committee room to wait rather than move.",
      "Policymakers signalled they would judge each meeting on incoming data and stressed that any future change would depend on wages and services inflation.",
      "Economists expect the next move to come later this year, with markets pricing only a modest chance of a cut before the summer.",
    ].join(" ");
    // Light-edit rewrite: same sentences, a few words swapped.
    const lightEdit = original
      .replace("judge each meeting", "judge every meeting")
      .replace("citing cooling inflation", "pointing to cooling inflation")
      .replace("room to wait rather than move", "room to wait rather than act");
    // Same event, written from scratch by another desk.
    const reReported = [
      "Rate-setters voted to keep borrowing costs where they are, the third meeting in a row without a change.",
      "The committee said inflation is drifting back toward its goal and that firms are still hiring at a solid pace.",
      "Traders now see little chance of a reduction before mid-year, according to market pricing.",
    ].join(" ");

    expect(contentSimilarity(original, original)).toBe(1);
    expect(contentSimilarity(original, lightEdit)).toBeGreaterThan(0.38);
    expect(contentSimilarity(original, reReported)).toBeLessThan(0.2);
    expect(contentSimilarity(original, "")).toBe(0);
    expect(contentSimilarity("", "")).toBe(0);

    // The simhash stored on posts stays a usable coarse prefilter.
    expect(simhashSimilarity(simhash(original), simhash(original))).toBe(1);
    expect(simhashSimilarity(simhash(original), simhash(original))).toBeGreaterThan(
      simhashSimilarity(simhash(original), simhash(reReported)),
    );
  });

  it("rejects an exact duplicate title but allows a fresh story", () => {
    const existing = [{ title: "Central bank holds rates steady as inflation cools" }];

    const duplicate = findDuplicate({ title: "Central bank holds rates steady as inflation cools" }, existing);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.reason).toBe("title-duplicate");

    const fresh = findDuplicate({ title: "City council approves night bus network" }, existing);
    expect(fresh.duplicate).toBe(false);
    expect(fresh.severity).toBe("none");
  });

  it("flags slug collisions", () => {
    const verdict = findDuplicate(
      { title: "Anything at all", slug: "same-slug" },
      [{ title: "Different headline", slug: "same-slug" }],
    );
    expect(verdict.reason).toBe("slug-collision");
  });

  it("reports a duplication risk the scorer can consume", () => {
    const near = findDuplicate(
      { title: "Central bank holds rates steady as inflation cools" },
      [{ title: "Central bank holds rates steady while inflation cools" }],
    );
    expect(duplicationRisk(near)).toBeGreaterThan(0.5);
    expect(duplicationRisk({ duplicate: false, severity: "duplicate", reason: "x" })).toBe(1);
  });

  it("collapses a batch to the most trustworthy copy and reports the rest", () => {
    const { kept, dropped } = dedupeBatch([
      { title: "Storm cuts power to 90,000 homes", trustTier: 2 },
      { title: "90,000 homes lose power in storm", trustTier: 1 },
      { title: "Streaming service orders new dramas", trustTier: 2 },
    ]);
    expect(kept).toHaveLength(2);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toContain("duplicate");
    expect(kept.some((k) => k.trustTier === 1)).toBe(true);
  });
});

describe("category classification", () => {
  it("classifies a clear technology story", () => {
    const result = classifyCategory({
      title: "Open-source AI model runs on a single consumer GPU",
      snippet: "Developers can now run the model locally without a cloud API, cutting inference costs.",
    });
    expect(result.slug).toBe("technology");
    expect(result.confidence).toBeGreaterThan(0.55);
    expect(result.method).toBe("lexicon");
  });

  it("classifies health, politics, sports and entertainment stories", () => {
    const cases: Array<[string, string]> = [
      ["Trial finds shorter treatment course works for common infection", "health"],
      ["Parliament passes budget after marathon session", "politics"],
      ["City club completes transfer of striker before deadline", "sports"],
      ["Streaming service orders six half-hour dramas", "entertainment"],
      ["Markets slide as inflation data surprises investors", "business"],
      ["Emergency crews restore power after storms", "breaking-news"],
    ];
    for (const [headline, expected] of cases) {
      const result = classifyCategory({ title: headline });
      expect(result.slug, headline).toBe(expected);
    }
  });

  it("falls back to the source hint when the text is ambiguous", () => {
    const result = classifyCategory({
      title: "The quiet week ahead in Brussels",
      sourceHint: "politics",
    });
    expect(result.slug).toBe("politics");
    expect(["source-hint", "fallback", "lexicon"]).toContain(result.method);
  });

  it("never returns an unknown category and always reports confidence", () => {
    const result = classifyCategory({ title: "Something entirely unclassifiable happens somewhere" });
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(0.98);
    expect(result.slug.length).toBeGreaterThan(2);
  });

  it("detects misclassification, tolerating the breaking-news overlay", () => {
    const technology = classifyCategory({ title: "Nvidia chip announcement lifts AI hardware" });
    expect(detectMisclassification("technology", technology).mismatch).toBe(false);
    expect(detectMisclassification("entertainment", technology).mismatch).toBe(true);
    expect(detectMisclassification("breaking-news", technology).mismatch).toBe(false);
    expect(detectMisclassification(null, technology).reason).toBe("missing-category");
  });
});

describe("SEO generation", () => {
  it("builds readable slugs", () => {
    expect(buildSlug("Central bank holds rates steady!")).toBe("central-bank-holds-rates-steady");
    expect(buildSlug("A very long headline about the European Central Bank and its benchmark rate decision in June", { maxLength: 40 }).length).toBeLessThanOrEqual(40);
    expect(buildSlug("!!!")).toBe("story");
  });

  it("appends a suffix when a slug is taken", () => {
    expect(ensureUniqueSlug("rates-held", ["rates-held"])).toBe("rates-held-2");
    expect(ensureUniqueSlug("fresh-slug", ["other"])).toBe("fresh-slug");
  });

  it("rejects clickbait, truncated and publisher-suffixed headlines", () => {
    expect(validateHeadline("You won't believe what the central bank did next").ok).toBe(false);
    expect(validateHeadline("Rates held steady - BBC News").issues).toContain("headline-has-publisher-suffix");
    expect(validateHeadline("Central bank holds benchmark rate steady for a third meeting").ok).toBe(true);
  });

  it("derives compliant meta fields when the model's are unusable", () => {
    const title = buildMetaTitle("Central bank holds rates steady for a third consecutive meeting", { brand: "NewsSparkle" });
    expect(title.length).toBeLessThanOrEqual(62);
    expect(title).toContain("NewsSparkle");

    const description = buildMetaDescription(
      "Policymakers left the benchmark rate unchanged for a third straight meeting, citing cooling " +
        "price growth and a resilient labour market, and signalled patience rather than a pivot.",
    );
    expect(description.length).toBeGreaterThan(100);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("extracts keywords and detects stuffing", () => {
    const keywords = extractKeywords(
      "Interest rates held steady. The interest rate decision keeps rates unchanged; interest rates matter for borrowers.",
    );
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.join(" ")).toContain("interest");

    expect(validateKeywordUsage("short text", ["one", "two"]).issues).toContain("too-few-keywords");
    expect(keywordDensity("rates rates rates rates other other word", "rates")).toBeGreaterThan(0.3);
  });

  it("assembles a publishable SEO bundle and records what it fixed", () => {
    const { bundle, validation } = prepareSeoBundle(
      {
        title: "Central bank holds benchmark rate steady for a third consecutive meeting",
        excerpt:
          "Policymakers left the benchmark rate unchanged, citing cooling inflation and a resilient labour market.",
        content:
          "The central bank held its benchmark rate steady. ## Why it matters Officials pointed to cooling " +
          "inflation and steady hiring. ## What next The committee meets again in six weeks.",
        metaTitle: "Too short",
        keywords: ["rates"],
      },
      { brand: "NewsSparkle", takenSlugs: ["central-bank-holds-benchmark-rate"] },
    );
    expect(bundle.slug).not.toBe("central-bank-holds-benchmark-rate");
    expect(bundle.metaTitle.length).toBeLessThanOrEqual(62);
    expect(bundle.keywords.length).toBeGreaterThanOrEqual(5);
    expect(validation.issues.some((i) => i.startsWith("generated:"))).toBe(true);
  });
});
