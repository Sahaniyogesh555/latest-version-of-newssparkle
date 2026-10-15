// Recorded AI responses used by tests.
//
// The newsroom pipeline is only as good as its reaction to messy model output,
// so these fixtures deliberately include the failure modes seen in production:
// fenced JSON, prose wrapped around JSON, a truncated body, a draft with an
// invented figure, and a refusal. Tests replay them through the pure parser
// and the quality gate.

export const WRITER_GOOD = {
  response: JSON.stringify({
    title: "Energy regulator reports 12% rise in wholesale prices",
    excerpt:
      "Wholesale energy prices rose 12% in March, adding about 180 pounds to a typical annual bill, the regulator said.",
    content: [
      "## What happened",
      "",
      "Wholesale energy prices rose 12% in March, the third consecutive monthly increase, and the regulator said the change " +
        "adds roughly 180 pounds to a typical household bill this year.",
      "The report, published on Thursday morning, attributes most of the increase to gas contracts signed before the winter, " +
        "when storage levels across Europe were unusually low and traders priced in a colder spring.",
      "Officials stressed that the increase is a wholesale effect and that it will reach household bills gradually rather " +
        "than in a single step, with suppliers required to give 30 days' notice of any change.",
      "",
      "## Why it matters",
      "",
      "Households are still absorbing two previous increases, and the regulator's own consumer panel reported that one in " +
        "five households has cut back on heating this spring.",
      "Analysts at the Energy Institute said the rise is smaller than the winter spike but lands at a difficult moment for " +
        "budgets already stretched by higher food and transport costs.",
      "The regulator added that support payments for low-income households remain unchanged this year, so the increase will " +
        "not be offset automatically for the households that need it most.",
      "Consumer groups have argued for months that standing charges, which are paid regardless of usage, fall hardest on " +
        "low-usage households and should be rebalanced.",
      "",
      "### Who is affected",
      "",
      "The change applies to variable tariffs, which cover most households. Fixed deals signed before the winter are " +
        "unaffected until they expire, and the regulator said suppliers must write to customers before any repricing.",
      "Businesses on pass-through contracts will see the change sooner, and industry bodies warned that energy-intensive " +
        "manufacturers may revisit production schedules if prices stay high into the summer.",
      "",
      "## What to watch",
      "",
      "The next market report is due in six weeks and will show whether the autumn decline in forward prices has started to " +
        "reach retail bills.",
      "The regulator will also publish its review of standing charges, which consumer groups say should be rebalanced so " +
        "that households using less energy are not penalised by fixed daily fees.",
      "Ministers have signalled they will wait for that review before deciding whether further support is needed this winter.",
    ].join("\n"),
    keyTakeaways: [
      "Wholesale prices rose 12% in March, the third rise in a row",
      "Typical annual bills rise by about 180 pounds",
      "Support payments are unchanged this year",
    ],
    faq: [
      { q: "Why are bills rising?", a: "Gas contracts signed before the winter are feeding through to retail prices." },
      { q: "When will it ease?", a: "The regulator expects the autumn decline to show in its next market report." },
      { q: "Do fixed deals change?", a: "No: fixed deals signed before the winter are unaffected until they expire." },
    ],
    metaTitle: "Energy prices rise 12% in March, regulator says",
    metaDescription:
      "Wholesale energy prices rose 12% in March, adding about 180 pounds to a typical household bill, the energy regulator said in its monthly report.",
    keywords: ["energy prices", "wholesale prices", "household bills", "regulator", "market report"],
  }),
  model: "gpt-4o-mini",
};

/** Full-length response with a body that is still far too short for the brief. */
export const WRITER_SHORT = {
  response: JSON.stringify({
    title: "Central bank holds benchmark rate for a third meeting",
    excerpt: "Policymakers left the benchmark rate unchanged for a third straight meeting, citing cooling inflation.",
    content: [
      "## What happened",
      "",
      "The central bank left its benchmark rate unchanged for a third consecutive meeting, citing cooling inflation and a " +
        "resilient labour market, and said decisions will be taken meeting by meeting rather than on a fixed path.",
      "## Why it matters",
      "",
      "Borrowers with variable-rate loans see no change this month, while savers keep the higher rates introduced last year.",
      "## What to watch",
      "",
      "The next decision is due in six weeks, alongside updated forecasts for growth and inflation.",
    ].join("\n"),
    metaTitle: "Central bank holds benchmark rate a third time",
    metaDescription:
      "Policymakers left the benchmark rate unchanged for a third straight meeting, citing cooling inflation and a steady labour market.",
    keywords: ["interest rates", "central bank", "inflation", "benchmark rate", "monetary policy"],
  }),
  model: "gpt-4o-mini",
};

/** Same shape, but wrapped in a markdown fence with chatter around it. */
export const WRITER_FENCED = {
  response:
    "Here is the article you asked for:\n\n```json\n" +
    JSON.stringify({
      title: "Central bank holds benchmark rate for a third meeting",
      excerpt: "Policymakers left the benchmark rate unchanged for a third straight meeting, citing cooling inflation.",
      content: [
        "## What happened",
        "",
        "The central bank left its benchmark rate unchanged for a third consecutive meeting, citing cooling inflation and a " +
          "resilient labour market, and said decisions will be taken meeting by meeting.",
        "## Why it matters",
        "",
        "Borrowers with variable-rate loans see no change this month, while savers keep the higher rates introduced last year.",
        "### What analysts say",
        "",
        "Economists expect the next move later this year and see only a modest chance of a cut before the summer, though " +
          "the committee has been careful not to pre-commit to a path.",
        "The bank said it will keep watching wages and services prices, which it described as the slowest parts of the " +
          "inflation picture to respond to higher rates.",
        "## What it means for borrowers",
        "",
        "- Variable-rate mortgages and loans: no change this month",
        "- Savers: rates on easy-access accounts stay where they are",
        "- Fixed deals: unaffected until they expire",
        "## What to watch",
        "",
        "The next decision is due in six weeks, alongside updated forecasts for growth and inflation that will show whether " +
          "the bank still expects to move later this year.",
      ].join("\n"),
      keyTakeaways: ["Rate held for a third meeting", "Decisions taken meeting by meeting", "Next decision in six weeks"],
      metaTitle: "Central bank holds benchmark rate a third time",
      metaDescription:
        "Policymakers left the benchmark rate unchanged for a third straight meeting, citing cooling inflation and a steady labour market.",
      keywords: ["interest rates", "central bank", "inflation", "benchmark rate", "monetary policy"],
    }) +
    "\n```\nLet me know if you want a shorter version.",
  model: "gpt-4o-mini",
};

/** Body far shorter than the target — must be caught by the completeness gate. */
export const WRITER_TRUNCATED = {
  response: JSON.stringify({
    title: "Storm closes coastal road for a second day",
    excerpt: "High winds closed the coastal road again, with crews clearing debris from the carriageway overnight.",
    content: "## What happened\n\nHigh winds closed the coastal road for a second day while crews cleared debris.",
    metaTitle: "Storm closes coastal road again",
    metaDescription: "High winds closed the coastal road for a second day while crews cleared fallen trees and debris.",
    keywords: ["storm", "coastal road", "travel disruption", "weather"],
  }),
  model: "gpt-4o-mini",
};

/** Contains figures that appear in no source: must never publish. */
export const WRITER_UNSUPPORTED_FIGURE = {
  response: JSON.stringify({
    title: "Regulator confirms energy price increase for spring",
    excerpt: "Wholesale prices rose 47% this spring, the regulator confirmed, raising typical bills by 900 pounds.",
    content: [
      "## What happened",
      "",
      "Wholesale energy prices rose 47% this spring and the regulator confirmed the change adds 900 pounds to a typical " +
        "bill, the largest increase ever recorded and a figure officials said would not be repeated this year.",
      "The confirmed increase follows months of speculation about how far the winter contracts would feed through, and the " +
        "regulator's statement settles the question for every household in the country.",
      "Officials also confirmed a 2 billion pound support package for the coming winter, which they said would cover the " +
        "increase for most households on variable tariffs.",
      "",
      "## Why it matters",
      "",
      "Households will see the increase from next month, and the regulator said the change affects every tariff in the " +
        "market, including fixed deals signed before the winter, which will now be repriced immediately.",
      "Consumer groups said the 900 pound figure was higher than they had been told to expect and that the support package " +
        "would not reach households on prepayment meters in time.",
      "Analysts said the 47% increase would push inflation higher for at least two quarters and could delay any reduction in " +
        "interest rates until the following year.",
      "",
      "### Who is affected",
      "",
      "Every household in the country is affected, according to the statement, with no exceptions for low-income homes or " +
        "for households that have already fixed their tariffs.",
      "Businesses on pass-through contracts face the same increase, and industry bodies said manufacturers would revisit " +
        "production schedules within weeks.",
      "",
      "## What to watch",
      "",
      "The regulator will publish a further report on the 2 billion pound package, and consumer groups have promised a legal " +
        "challenge within days.",
      "Ministers are expected to face questions on the timing of the announcement, which came after the market closed.",
      "The next inflation release will show whether the 47% increase has fed into consumer prices as quickly as analysts fear.",
    ].join("\n"),
    keyTakeaways: ["Prices rose 47%", "Bills rise by 900 pounds", "Support package worth 2 billion pounds"],
    metaTitle: "Regulator confirms 47% energy price increase",
    metaDescription: "Wholesale energy prices rose 47% this spring, adding 900 pounds to a typical household bill, the regulator confirmed.",
    keywords: ["energy prices", "regulator", "household bills", "tariffs", "increase"],
  }),
  model: "gpt-4o-mini",
};

/** Not JSON at all — the pipeline must reject rather than guess. */
export const WRITER_UNPARSEABLE = {
  response: "I'm sorry, I can't help with that request.",
  model: "gpt-4o-mini",
};

export const VERIFIER_SUPPORTED = {
  response: JSON.stringify({
    supported: true,
    confidence: 0.86,
    unsupportedClaims: [],
    contradictions: [],
    notes: "All figures appear in the source material.",
  }),
  model: "gpt-4o-mini",
};

export const VERIFIER_REJECTED = {
  response: JSON.stringify({
    supported: false,
    confidence: 0.8,
    unsupportedClaims: ["Wholesale prices rose 47%", "Bills rise by 900 pounds"],
    contradictions: ["The source says 12%, not 47%"],
    notes: "Figures do not match the supplied sources.",
  }),
  model: "gpt-4o-mini",
};

export const VERIFIER_GARBAGE = {
  response: "Sure — the article looks broadly accurate to me.",
  model: "gpt-4o-mini",
};

export const HEADLINES = {
  response: JSON.stringify({
    headlines: [
      "Regulator reports 12% rise in wholesale energy prices",
      "Energy bills to rise after 12% wholesale price jump",
      "Wholesale energy prices climb 12% in March, regulator says",
    ],
  }),
  model: "gpt-4o-mini",
};

export const ALT_TEXT = {
  response: JSON.stringify({ alt: "A gas meter and pipework on the outside wall of a terraced house" }),
  model: "gpt-4o-mini",
};

/** Sources the fixtures are written against. */
export const FIXTURE_SOURCES = [
  {
    title: "Energy regulator reports 12% rise in wholesale prices",
    url: "https://example.com/energy-prices",
    snippet:
      "The regulator said wholesale energy prices rose 12% in March, adding around 180 pounds to a typical annual bill, " +
      "the third consecutive increase, with officials blaming gas contracts signed before the heating season.",
    published: "2026-10-16T08:00:00Z",
    sourceName: "BBC World",
    trustTier: 1 as const,
    categoryHint: "business",
  },
  {
    title: "Household energy costs climb again as contracts bite",
    url: "https://example.com/energy-costs",
    snippet:
      "Wholesale gas prices rose 12% in March and the rise will reach variable tariffs gradually, the regulator said.",
    published: "2026-10-16T07:30:00Z",
    sourceName: "Reuters",
    trustTier: 1 as const,
    categoryHint: "business",
  },
];
