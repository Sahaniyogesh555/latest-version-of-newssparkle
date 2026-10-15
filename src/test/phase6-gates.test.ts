/**
 * Phase 6 — editorial gates: safety screening, fact consistency, quality
 * scoring, scheduling limits, failure recovery and feed hygiene.
 *
 * These are the rules that decide what may be published with nobody watching,
 * so each one is asserted directly against the module that implements it.
 */
import { describe, it, expect, vi } from "vitest";
import { scanSafety, isClickbait, mergeSafetyReports, summarizeSafety } from "../../supabase/functions/_shared/safety.ts";
import {
  attributionReport,
  consistencyReport,
  groundingReport,
  isRewritableText,
  plagiarismReport,
  structureReport,
} from "../../supabase/functions/_shared/facts.ts";
import { QUALITY_THRESHOLDS, evaluateQuality, summarizeQuality } from "../../supabase/functions/_shared/quality.ts";
import {
  EDITION_TARGETS,
  PUBLISH_LIMITS,
  balanceCategories,
  canPublishNow,
  catchUpPlan,
  editionForHour,
  editionRemaining,
  nextEdition,
  planEditionTimes,
  rescheduleOverdue,
  utcDateString,
  wordTargetFor,
} from "../../supabase/functions/_shared/schedule.ts";
import {
  CircuitBreaker,
  HttpError,
  backoffDelay,
  chunk,
  guardedFetch,
  isRetryableStatus,
  mapWithConcurrency,
  withRetry,
} from "../../supabase/functions/_shared/retry.ts";
import {
  SOURCE_HEALTH,
  candidatePriority,
  cooldownUntil,
  filterFeedItems,
  parseFeedXml,
  sourceHealthDecision,
  sourceLabelFromUrl,
  trustWeight,
  validateFeedItem,
} from "../../supabase/functions/_shared/sources.ts";
import type { SourceFeedItem } from "../../supabase/functions/_shared/types.ts";

const SOURCE: SourceFeedItem = {
  title: "source",
  sourceName: "BBC World",
  trustTier: 1,
  url: "https://example.com/source",
};

const SOURCE_TEXT =
  "The regulator said wholesale energy prices rose 12% in March, adding around 180 pounds to a typical annual bill, " +
  "the third consecutive increase and the steepest since the winter, with officials blaming global gas contracts " +
  "signed before the heating season and warning that the effect will persist into the summer months.";

const GOOD_BODY = [
  "## What happened",
  "",
  "Wholesale energy prices rose 12% in March, the third consecutive monthly increase, and the regulator said the change " +
    "adds roughly 180 pounds to a typical household bill this year.",
  "The report, published on Thursday morning, attributes most of the increase to gas contracts signed before the winter, " +
    "when European storage levels were unusually low and traders priced in a colder spring.",
  "Officials stressed that the increase is a wholesale effect and that it will feed through to household bills gradually " +
    "rather than all at once.",
  "",
  "## Why it matters",
  "",
  "Households are already carrying the cost of two previous increases, and the regulator's own consumer panel reported " +
    "that one in five households has cut back on heating this spring.",
  "Analysts at the Energy Institute said the change is smaller than the winter spike but lands at a difficult moment for " +
    "budgets, which are still absorbing higher food and transport costs.",
  "The regulator added that support payments for low-income households remain unchanged this year, so the increase will not " +
    "be offset automatically for the households that need it most.",
  "",
  "### Who is affected",
  "",
  "The change applies to variable tariffs, which cover most households. Fixed deals signed before the winter are unaffected " +
    "until they expire, and the regulator says suppliers must give customers 30 days' notice of any change.",
  "",
  "## What to watch",
  "",
  "The next market report is due in six weeks and will show whether the autumn decline in forward prices has started to " +
    "feed through to retail bills.",
  "The regulator will also publish its review of standing charges, which consumer groups argue hit low-usage households " +
    "hardest and should be rebalanced.",
].join("\n");

describe("safety gates", () => {
  it("passes ordinary news copy", () => {
    const report = scanSafety(GOOD_BODY);
    expect(report.safe).toBe(true);
    expect(report.clickbait).toBe(false);
    expect(summarizeSafety(report)).toBe("clean");
  });

  it("flags medical and financial claims as critical", () => {
    const medical = scanSafety("You should stop taking your medication immediately, doctors say this supplement cures diabetes.");
    expect(medical.safe).toBe(false);
    expect(medical.flags.some((f) => f.severity === "critical")).toBe(true);
    expect(scanSafety("You should stop taking your medication now.").safe).toBe(false);
    expect(scanSafety("You should stop taking your medication now", { titleOnly: true }).safe).toBe(false);

    const financial = scanSafety("Everyone should invest their savings in this coin, guaranteed returns of 40%.");
    expect(financial.safe).toBe(false);
  });

  it("escalates unattributed criminal allegations but only warns on rumour", () => {
    const fabricated = scanSafety(
      "Sources claim that the minister secretly fled the country last night, though no official has confirmed it.",
    );
    expect(fabricated.safe).toBe(false);
    expect(fabricated.flags.map((f) => f.code)).toContain("defamation-risk");
    expect(fabricated.flags.map((f) => f.code)).toContain("unverified-rumour");

    const rumourOnly = scanSafety("Rumours about the merger have circulated for weeks, the company said in a statement.");
    expect(rumourOnly.safe).toBe(true);
    expect(rumourOnly.flags.some((f) => f.code === "unverified-rumour")).toBe(true);
  });

  it("detects clickbait without flagging a normal headline", () => {
    expect(isClickbait("You won't believe what happened to this bank CEO")).toBe(true);
    expect(isClickbait("SHOCKING! Everything we know so far!!!")).toBe(true);
    expect(isClickbait("Central bank holds rates steady for third meeting")).toBe(false);
  });

  it("merges reports and summarises them", () => {
    const merged = mergeSafetyReports(
      scanSafety("Ordinary reporting about a council budget."),
      scanSafety("Sponsored content: buy our miracle cure now."),
    );
    expect(merged.safe).toBe(false);
    expect(summarizeSafety(merged).length).toBeGreaterThan(3);
    expect(mergeSafetyReports(scanSafety("Clean text")).safe).toBe(true);
  });
});

describe("fact consistency", () => {
  const sources: SourceFeedItem[] = [
    {
      ...SOURCE,
      title: "Energy regulator reports 12% rise in wholesale prices",
      snippet: SOURCE_TEXT,
    },
  ];

  it("keeps supported figures and reports the ones it cannot place", () => {
    const grounded = groundingReport(GOOD_BODY, sources);
    expect(grounded.numbersTotal).toBeGreaterThan(0);
    expect(grounded.score).toBeGreaterThan(0.5);

    const invented = groundingReport("Prices jumped 87% overnight, wiping 4,200 pounds off savings.", sources);
    expect(invented.numbersUnsupported.length).toBeGreaterThan(0);
    expect(invented.score).toBeLessThan(1);
  });

  it("detects verbatim copying and clears an original rewrite", () => {
    const copy = plagiarismReport(SOURCE_TEXT, sources);
    expect(copy.risky).toBe(true);
    expect(copy.maxRunLength).toBeGreaterThan(24);
    expect(copy.worstSource).toBe("BBC World");

    expect(plagiarismReport(GOOD_BODY, sources).risky).toBe(false);
  });

  it("checks structure against the edition target", () => {
    const report = structureReport(GOOD_BODY, { minWords: 220, minH2: 2, minH3: 1, minParagraphs: 4 });
    expect(report.ok).toBe(true);
    expect(report.h2).toBeGreaterThanOrEqual(2);
    expect(report.h3).toBeGreaterThanOrEqual(1);
    expect(report.wordCount).toBeGreaterThan(250);

    const thin = structureReport("One short paragraph.", { minWords: 320 });
    expect(thin.ok).toBe(false);
    expect(thin.issues.join(" ")).toContain("too-short");
  });

  it("wants an attribution to the source", () => {
    const withCredit = attributionReport(`${GOOD_BODY}\n\nAccording to BBC World, the figures cover March only.`, sources);
    expect(withCredit.hasAttributionPhrase).toBe(true);
    expect(withCredit.mentions).toContain("BBC World");
    expect(withCredit.score).toBeGreaterThan(0.3);

    const threeLetterName: SourceFeedItem = { ...SOURCE, sourceName: "BBC" };
    expect(attributionReport("The BBC reported the increase on Thursday.", [threeLetterName]).mentions).toEqual(["BBC"]);

    expect(attributionReport(GOOD_BODY, sources).score).toBeLessThan(withCredit.score);
  });

  it("combines everything into a single consistency verdict", () => {
    const result = consistencyReport({ draft: `${GOOD_BODY}\n\nAccording to BBC World, the figure is preliminary.`, sources });
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.grounding.numbersTotal).toBeGreaterThan(0);
    expect(result.plagiarism.risky).toBe(false);

    const bad = consistencyReport({ draft: SOURCE_TEXT, sources, modelSupported: false, modelConfidence: 0.2 });
    expect(bad.ok).toBe(false);
    expect(bad.reasons.length).toBeGreaterThanOrEqual(1);
    expect(bad.softReasons.join(" ")).toContain("verification");
  });

  it("refuses to rewrite text that is too thin to verify", () => {
    expect(isRewritableText("Short.")).toBe(false);
    expect(isRewritableText(GOOD_BODY)).toBe(true);
  });
});

describe("quality scoring", () => {
  const base = {
    title: "Energy regulator reports 12% rise in wholesale prices",
    excerpt:
      "Wholesale energy prices rose 12% in March, adding about 180 pounds to a typical household bill, the regulator said.",
    content: GOOD_BODY,
    metaTitle: "Energy prices rise 12% in March, regulator says",
    metaDescription:
      "Wholesale energy prices rose 12% in March, adding around 180 pounds to a typical household bill, the energy regulator said in its monthly report.",
    keywords: ["energy prices", "wholesale prices", "household bills", "regulator", "market report"],
    faq: [
      { q: "Why are bills rising?", a: "Wholesale gas contracts signed before winter are feeding through." },
      { q: "When will it ease?", a: "The regulator expects the autumn decline to start showing in the next report." },
    ],
    keyTakeaways: [
      "Wholesale prices rose 12% in March",
      "Typical annual bills rise by about 180 pounds",
      "Support payments are unchanged this year",
    ],
    targetWords: 300,
    sources: [
      {
        ...SOURCE,
        title: "Energy regulator reports 12% rise in wholesale prices",
        snippet: SOURCE_TEXT,
      },
    ],
  };

  it("publishes a complete, sourced, well-structured draft", () => {
    const { report } = evaluateQuality(base);
    expect(report.blockingReasons).toEqual([]);
    expect(report.reviewReasons).toEqual([]);
    expect(report.score).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.publish);
    expect(report.verdict).toBe("publish");
  });

  it("sends a mediocre draft to human review", () => {
    const { report } = evaluateQuality({
      ...base,
      keyTakeaways: [],
      faq: [],
      keywords: ["energy"],
      targetWords: 700,
    });
    expect(report.verdict).not.toBe("publish");
    expect(summarizeQuality(report)).toContain("score=");
  });

  it("blocks plagiarism no matter how high the score", () => {
    const { report } = evaluateQuality({
      ...base,
      plagiarism: { maxRunLength: 40, overlapRatio: 0.6, risky: true, worstSource: "BBC World" },
    });
    expect(report.verdict).toBe("reject");
    expect(report.blockingReasons.join(" ")).toContain("originality");
  });

  it("blocks duplicates, unsafe content, truncated drafts and unverifiable claims", () => {
    expect(evaluateQuality({ ...base, duplicationRisk: 1 }).report.verdict).toBe("reject");
    expect(evaluateQuality({ ...base, content: "Too short." }).report.blockingReasons.join(" ")).toContain(
      "completeness",
    );
    expect(evaluateQuality({ ...base, content: "Too short." }).report.verdict).toBe("reject");

    const unsafe = evaluateQuality({
      ...base,
      content: `${GOOD_BODY}\n\nYou should stop taking your medication now, the article tells readers.`,
    });
    expect(unsafe.report.verdict).toBe("reject");
    expect(unsafe.report.blockingReasons.join(" ")).toContain("safety");

    const unverified = evaluateQuality({ ...base, verification: { modelSupported: false } }).report;
    expect(unverified.verdict).toBe("review");
    expect(unverified.blockingReasons).toEqual([]);
    expect(unverified.reviewReasons.join(" ")).toContain("verification");
  });

  it("records a breakdown that sums to the score", () => {
    const { report } = evaluateQuality(base);
    const total = Object.values(report.breakdown).reduce((a, b) => a + b, 0);
    expect(Math.abs(total - report.score)).toBeLessThan(0.05);
  });
});

describe("scheduling engine", () => {
  it("maps hours to editions and picks the next one", () => {
    expect(editionForHour(7)).toBe("morning");
    expect(editionForHour(13)).toBe("midday");
    expect(editionForHour(19)).toBe("evening");
    expect(editionForHour(3)).toBeNull();
    expect(nextEdition(3)).toBe("morning");
    expect(Object.values(EDITION_TARGETS).reduce((a, b) => a + b, 0)).toBe(PUBLISH_LIMITS.maxPerDay);
  });

  it("spreads an edition across its window with guaranteed spacing", () => {
    const slots = planEditionTimes({ edition: "midday", count: EDITION_TARGETS.midday, date: "2026-10-16" });
    expect(slots).toHaveLength(EDITION_TARGETS.midday);
    for (const slot of slots) {
      expect(slot.at.getUTCHours()).toBeGreaterThanOrEqual(12);
      expect(slot.at.getUTCHours()).toBeLessThanOrEqual(16);
    }
    for (let i = 1; i < slots.length; i++) {
      const gap = (slots[i].at.getTime() - slots[i - 1].at.getTime()) / 60_000;
      expect(gap).toBeGreaterThanOrEqual(PUBLISH_LIMITS.minGapMinutes);
    }
    // Deterministic: the same input always produces the same timetable.
    expect(planEditionTimes({ edition: "midday", count: 6, date: "2026-10-16" })[0].at.toISOString()).toBe(
      slots[0].at.toISOString(),
    );
  });

  it("stops flooding, daily caps and category domination", () => {
    const now = new Date("2026-10-16T12:00:00Z");
    expect(canPublishNow({ now, publishedToday: 0, category: "world", categoryPublishedToday: 0 }).allowed).toBe(true);
    expect(
      canPublishNow({ now, publishedToday: 0, category: "world", categoryPublishedToday: 0, publishedThisRun: 2 }).reason,
    ).toBe("burst-limit");
    expect(canPublishNow({ now, publishedToday: 18, category: "world", categoryPublishedToday: 0 }).reason).toBe(
      "daily-cap",
    );
    expect(canPublishNow({ now, publishedToday: 3, category: "world", categoryPublishedToday: 5 }).reason).toContain(
      "category-cap",
    );
    const gap = canPublishNow({
      now,
      lastPublishedAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
      publishedToday: 4,
      category: "world",
      categoryPublishedToday: 1,
    });
    expect(gap.reason).toBe("min-gap");
    expect(gap.waitMinutes).toBeGreaterThan(0);
  });

  it("balances categories and respects the daily cap", () => {
    const picks = balanceCategories({
      available: [
        { slug: "sports", candidates: 9 },
        { slug: "world", candidates: 4 },
        { slug: "technology", candidates: 2 },
      ],
      publishedToday: { sports: 5, world: 1 },
    });
    // Sports is at the per-category cap, so it drops out despite having the
    // most candidates; the least-covered section leads the order.
    expect(picks.map((p) => p.slug)).toEqual(["technology", "world"]);
    expect(picks[0].reason).toContain("waiting");

    const empty = balanceCategories({ available: [{ slug: "sports", candidates: 0 }], publishedToday: {} });
    expect(empty).toEqual([]);
  });

  it("recovers a missed run without dumping the backlog", () => {
    const plan = catchUpPlan({ now: new Date("2026-10-16T09:00:00Z"), overdue: 7, publishedToday: 2 });
    expect(plan.publish).toBeLessThanOrEqual(PUBLISH_LIMITS.maxBurstPerRun);
    expect(plan.note).toContain("overdue");
    expect(catchUpPlan({ now: new Date(), overdue: 0, publishedToday: 0 }).publish).toBe(0);

    const rescheduled = rescheduleOverdue({ now: new Date("2026-10-16T09:00:00Z"), overdueCount: 3 });
    expect(rescheduled).toHaveLength(3);
    for (let i = 1; i < rescheduled.length; i++) {
      const gap = (rescheduled[i].getTime() - rescheduled[i - 1].getTime()) / 60_000;
      expect(gap).toBeGreaterThanOrEqual(PUBLISH_LIMITS.minGapMinutes);
    }
  });

  it("knows how much of the edition is still outstanding", () => {
    expect(editionRemaining({ edition: "morning", publishedToday: 2, scheduledToday: 1 })).toBe(2);
    expect(editionRemaining({ edition: "evening", publishedToday: 18, scheduledToday: 0 })).toBe(0);
    expect(wordTargetFor("morning")).toBeLessThan(wordTargetFor("evening"));
    expect(utcDateString(new Date("2026-10-16T23:30:00Z"))).toBe("2026-10-16");
  });
});

describe("failure recovery", () => {
  it("backs off exponentially and caps the delay", () => {
    expect(backoffDelay(1, { baseMs: 1000, jitter: 0 })).toBe(1000);
    expect(backoffDelay(2, { baseMs: 1000, jitter: 0 })).toBe(2000);
    expect(backoffDelay(20, { baseMs: 1000, maxMs: 30_000, jitter: 0 })).toBe(30_000);
  });

  it("retries transient failures and gives up cleanly", async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const value = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("flaky");
        return "ok";
      },
      { attempts: 5, sleep },
    );
    expect(value).toBe("ok");
    expect(sleep).toHaveBeenCalledTimes(2);

    await expect(
      withRetry(
        async () => {
          throw new Error("always down");
        },
        { attempts: 3, sleep },
      ),
    ).rejects.toThrow(/always down/);
  });

  it("stops retrying a non-retryable error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new HttpError(404, "https://example.com", "not found");
        },
        {
          attempts: 5,
          sleep: async () => {},
          shouldRetry: (error) => !(error instanceof HttpError && error.status === 404),
        },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(1);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it("opens a circuit breaker after repeated failures and probes later", () => {
    const breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 60_000 });
    const t0 = 1_000_000;
    expect(breaker.state(t0)).toBe("closed");
    breaker.recordFailure(t0);
    breaker.recordFailure(t0);
    expect(breaker.canAttempt(t0)).toBe(true);
    breaker.recordFailure(t0);
    expect(breaker.state(t0)).toBe("open");
    expect(breaker.canAttempt(t0 + 30_000)).toBe(false);
    expect(breaker.state(t0 + 61_000)).toBe("half-open");
    breaker.recordSuccess();
    expect(breaker.state(t0 + 61_000)).toBe("closed");

    const parked = new CircuitBreaker();
    parked.trip(t0 + 3_600_000, t0);
    expect(parked.canAttempt(t0 + 60_000)).toBe(false);
    expect(parked.consecutiveFailures).toBeGreaterThanOrEqual(3);
  });

  it("retries a retryable HTTP status and returns the rest", async () => {
    let attempts = 0;
    const fetchImpl = (async () => {
      attempts++;
      return attempts === 1 ? new Response("busy", { status: 503 }) : new Response("<rss></rss>", { status: 200 });
    }) as unknown as typeof fetch;

    const ok = await guardedFetch("https://example.com/feed.xml", { fetchImpl, attempts: 2 });
    expect(ok.status).toBe(200);
    expect(attempts).toBe(2);
  });

  it("bounds concurrency and batch sizes", async () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return value * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("feed ingestion hygiene", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[Energy regulator reports 12% rise in wholesale prices]]></title>
    <link>https://example.com/energy-prices</link>
    <description><![CDATA[<p>The regulator said wholesale energy prices rose 12% in March, adding around 180 pounds to a typical bill.</p>]]></description>
    <pubDate>${new Date(now.getTime() - 3_600_000).toUTCString()}</pubDate>
  </item>
  <item>
    <title>Parliament passes budget after a marathon overnight session</title>
    <link>https://example.com/budget</link>
    <description>Lawmakers approved the spending plan shortly after dawn following a session that ran through the night.</description>
    <pubDate>${new Date(now.getTime() - 7_200_000).toUTCString()}</pubDate>
  </item>
</channel></rss>`;

  it("parses RSS with CDATA and dates", () => {
    const parsed = parseFeedXml(rss, { name: "BBC World", trustTier: 1, categoryHint: "world" });
    expect(parsed.format).toBe("rss");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].title).toContain("Energy regulator");
    expect(parsed.items[0].snippet).toContain("wholesale energy prices rose 12%");
    expect(parsed.items[0].trustTier).toBe(1);
  });

  it("parses Atom entries", () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Emergency crews restore power after overnight storms</title>
        <link rel="alternate" href="https://example.com/storm"/>
        <summary>Crews worked through the night after storms brought down trees and damaged substations.</summary>
        <updated>${now.toISOString()}</updated>
      </entry>
    </feed>`;
    const parsed = parseFeedXml(atom, { name: "NPR", trustTier: 2 });
    expect(parsed.format).toBe("atom");
    expect(parsed.items[0].url).toBe("https://example.com/storm");
  });

  it("never throws on malformed input", () => {
    const descriptor = { name: "BBC World", trustTier: 1 as const };
    expect(parseFeedXml("", descriptor).items).toEqual([]);
    expect(parseFeedXml("<html><body>not a feed</body></html>", descriptor).format).toBe("unknown");
    expect(parseFeedXml("<rss><item><title>", descriptor).items).toEqual([]);
  });

  it("rejects furniture, spam bait, stale and non-English items", () => {
    const check = (title: string, extra: Partial<SourceFeedItem> = {}) =>
      validateFeedItem({ ...SOURCE, title, snippet: "x".repeat(60), ...extra }, { now });

    expect(check("Subscribe to our newsletter for the best coverage").reason).toBe("promotional");
    expect(check("Sponsored: the best mortgage deals this autumn season").reason).toBe("sponsored");
    expect(check("Podcast: the week in markets and what comes next").reason).toBe("non-article-format");
    expect(check("You won't believe what this bank did next, experts are stunned").reason).toBe("clickbait");
    expect(check("केन्द्रीय बैंक ने ब्याज दरें स्थिर रखीं और बाजार में उतार चढ़ाव देखा गया").reason).toBe("non-english");
    expect(check("Short headline here").reason).toBe("title-too-short");
    expect(check("Energy prices rise again across the region this month", { published: "2026-10-10T00:00:00Z" }).reason).toBe(
      "stale",
    );
    expect(check("Energy prices rise again across the region this month", { published: "2026-10-18T00:00:00Z" }).reason).toBe(
      "future-dated",
    );
    // Shouted headlines are rejected by the clickbait check first; either way
    // they never become candidates.
    expect(["shouting-headline", "clickbait"]).toContain(
      check("SHOUTING HEADLINE ABOUT A STORM THAT HIT EVERYTHING").reason,
    );
    // Sentence-case prose must survive the shouting check.
    expect(check("Central bank holds rates, says the full statement follows").ok).toBe(true);
  });

  it("flags undated and thin items instead of dropping them, then filters a batch", () => {
    const undated = validateFeedItem(
      { ...SOURCE, title: "Central bank holds rates steady for a third meeting", snippet: "Too short." },
      { now },
    );
    expect(undated.ok).toBe(true);
    expect(undated.warnings).toEqual(expect.arrayContaining(["thin-snippet", "undated"]));

    const { accepted, rejected } = filterFeedItems(
      [
        { ...SOURCE, title: "Subscribe to our newsletter for the best morning coverage" },
        {
          ...SOURCE,
          title: "Parliament passes budget after a marathon overnight session",
          url: "https://example.com/budget",
          published: new Date(now.getTime() - 3_600_000).toISOString(),
          snippet: "Lawmakers approved the spending plan shortly after dawn following a night-long session.",
        },
        {
          ...SOURCE,
          title: "Parliament passes the budget after an overnight session",
          url: "https://example.com/budget?utm_source=rss",
          published: new Date(now.getTime() - 3_600_000).toISOString(),
          snippet: "Duplicate of the same link with a tracking parameter appended to the URL.",
        },
      ],
      { now },
    );
    expect(accepted).toHaveLength(1);
    expect(rejected.map((r) => r.reason)).toEqual(expect.arrayContaining(["promotional", "duplicate-url"]));
  });

  it("parks a repeatedly failing feed with exponential cooldown", () => {
    expect(sourceHealthDecision(1).disable).toBe(false);
    const decision = sourceHealthDecision(SOURCE_HEALTH.failureThreshold);
    expect(decision.disable).toBe(true);
    expect(decision.cooldownHours).toBeGreaterThanOrEqual(6);
    expect(sourceHealthDecision(9).cooldownHours).toBeLessThanOrEqual(72);
    expect(sourceHealthDecision(9).cooldownHours).toBeGreaterThan(decision.cooldownHours);
    const until = cooldownUntil(now, 6);
    expect(until.getTime() - now.getTime()).toBe(6 * 3_600_000);
  });

  it("ranks candidates by trust, freshness, corroboration and trend", () => {
    const trusted = candidatePriority({ trustTier: 1, corroboration: 3, published: now.toISOString(), now });
    const weak = candidatePriority({ trustTier: 3, corroboration: 1, published: "2026-10-15T12:00:00Z", now });
    expect(trusted).toBeGreaterThan(weak);
    expect(trustWeight(1)).toBeGreaterThan(trustWeight(2));
    expect(trustWeight(2)).toBeGreaterThan(trustWeight(3));
    expect(sourceLabelFromUrl("https://www.bbc.co.uk/news/world")).toBe("bbc.co.uk");
    expect(sourceLabelFromUrl("not-a-url")).toBe("unknown-source");
  });
});
