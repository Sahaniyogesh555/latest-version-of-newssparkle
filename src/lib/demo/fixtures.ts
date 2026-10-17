/**
 * Sample newsroom data for local development and previews.
 *
 * These are FICTIONAL stories used only to exercise the UI when
 * VITE_DEMO_MODE=true (see demoClient.ts). They are never bundled into a
 * production build: the demo client is tree-shaken away when the flag is off.
 */

const daysAgo = (days: number, hour = 6) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

export interface DemoPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_title: string;
  meta_description: string;
  keywords: string[];
  featured_image_url: string;
  featured_image_alt: string;
  category_slug: string;
  author: string;
  status: string;
  reading_minutes: number;
  views: number;
  faq: Array<{ q: string; a: string }>;
  key_takeaways: string[];
  published_at: string;
  created_at: string;
  updated_at: string;
}

const image = (seed: string) => `https://picsum.photos/seed/${seed}/1600/900`;

const body = (lead: string, sections: Array<[string, string]>) =>
  [
    `**${lead}**`,
    "",
    ...sections.flatMap(([heading, text]) => [`## ${heading}`, "", text, ""]),
    "### What to watch next",
    "",
    "NewsSparkle will update this story as more details are confirmed.",
  ].join("\n");

export const DEMO_POSTS: DemoPost[] = [
  {
    id: "demo-1",
    title: "Central bank holds rates steady, signalling patience on inflation",
    slug: "central-bank-holds-rates-steady",
    excerpt:
      "Policymakers left the benchmark rate unchanged for a third straight meeting, citing cooling price growth and a resilient labour market.",
    content: body(
      "The benchmark rate will stay where it is for now.",
      [
        ["Why the decision matters", "Borrowing costs for mortgages, credit cards and business loans stay put, giving households a breather after two years of increases."],
        ["What officials said", "The committee described inflation as moving in the right direction but not yet at target, and pointed to wage growth as the indicator it is watching most closely."],
        ["The dissenting view", "Two members argued for a quarter-point cut, warning that holding too long risks tipping hiring into reverse."],
      ],
    ),
    meta_title: "Central bank holds rates steady",
    meta_description:
      "The central bank left its benchmark rate unchanged for a third meeting, citing cooling inflation and a resilient labour market.",
    keywords: ["interest rates", "central bank", "inflation", "monetary policy", "economy"],
    featured_image_url: image("rates"),
    featured_image_alt: "The central bank building during the morning session",
    category_slug: "business",
    author: "Business & Markets Desk",
    status: "published",
    reading_minutes: 5,
    views: 1840,
    faq: [
      { q: "Did rates change?", a: "No. The benchmark rate was left unchanged for a third consecutive meeting." },
      { q: "What happens to my mortgage?", a: "Tracker mortgages linked to the policy rate stay at their current level for now." },
      { q: "When is the next decision?", a: "The committee meets again in six weeks." },
    ],
    key_takeaways: [
      "Rate held for a third meeting running",
      "Inflation described as improving but not at target",
      "Two members pushed for a cut",
      "Wage growth is the indicator to watch",
    ],
    published_at: daysAgo(0, 7),
    created_at: daysAgo(0, 7),
    updated_at: daysAgo(0, 9),
  },
  {
    id: "demo-2",
    title: "Regulators open review of automated decision systems in public services",
    slug: "regulators-review-automated-decisions",
    excerpt:
      "A cross-agency review will examine how automated tools are used to screen benefit claims, with findings due next spring.",
    content: body(
      "Automated screening tools used by public agencies will face a formal review.",
      [
        ["What is being examined", "The review covers systems that triage applications, flag suspected fraud and prioritise casework, and asks whether people can meaningfully appeal a decision."],
        ["How the tools are used today", "At least a dozen agencies run some form of automated triage; most say a human signs off on final decisions."],
        ["What comes next", "A draft framework on transparency and appeal rights is expected before the review's findings are published."],
      ],
    ),
    meta_title: "Review of automated decisions opens",
    meta_description:
      "A cross-agency review will examine automated triage tools in public services, including appeal rights and transparency.",
    keywords: ["automation", "public services", "transparency", "policy", "accountability"],
    featured_image_url: image("review"),
    featured_image_alt: "Officials at a public hearing",
    category_slug: "politics",
    author: "Politics & Policy Desk",
    status: "published",
    reading_minutes: 6,
    views: 920,
    faq: [
      { q: "Which agencies are involved?", a: "A dozen agencies across benefits, tax and immigration are in scope." },
      { q: "Can decisions still be appealed?", a: "Yes — the review is examining how well existing appeal routes work in practice." },
      { q: "When will findings be published?", a: "The framework draft comes first, with findings expected next spring." },
    ],
    key_takeaways: [
      "Covers triage, fraud flags and casework prioritisation",
      "Appeal rights are the central question",
      "Draft framework due before findings",
    ],
    published_at: daysAgo(0, 5),
    created_at: daysAgo(0, 5),
    updated_at: daysAgo(0, 5),
  },
  {
    id: "demo-3",
    title: "Open-source model release reshapes how small teams build AI features",
    slug: "open-source-model-release-small-teams",
    excerpt:
      "A permissively licensed model with strong reasoning benchmarks is making on-device assistants practical for teams without large budgets.",
    content: body(
      "The release lowers the cost of shipping a capable assistant.",
      [
        ["What changed", "The model runs on a single consumer GPU at usable speed and is licensed for commercial use, removing the two barriers that kept small teams on hosted APIs."],
        ["Why teams care", "Inference costs that used to scale with every request become a fixed hardware cost."],
        ["The trade-offs", "Hosted frontier models still lead on the hardest reasoning tasks, and self-hosting shifts maintenance onto the team.",
        ],
      ],
    ),
    meta_title: "Open-source model shifts AI economics",
    meta_description:
      "A permissively licensed model that runs on consumer hardware is changing how small teams build AI features.",
    keywords: ["open source", "artificial intelligence", "on-device", "developers", "inference"],
    featured_image_url: image("model"),
    featured_image_alt: "Developer working at a workstation with two monitors",
    category_slug: "technology",
    author: "Technology & AI Desk",
    status: "published",
    reading_minutes: 7,
    views: 2610,
    faq: [
      { q: "Can it run on a laptop?", a: "Yes, at reduced speed; a single desktop GPU is the practical floor." },
      { q: "Is commercial use allowed?", a: "The licence permits commercial use without a royalty." },
      { q: "Does it beat hosted models?", a: "On the hardest reasoning tasks, hosted frontier models still lead." },
    ],
    key_takeaways: [
      "Runs on a single consumer GPU",
      "Commercial use permitted",
      "Turns per-request cost into fixed hardware cost",
      "Frontier hosted models still lead on hardest tasks",
    ],
    published_at: daysAgo(1, 8),
    created_at: daysAgo(1, 8),
    updated_at: daysAgo(1, 10),
  },
  {
    id: "demo-4",
    title: "Trial finds shorter treatment course works for common infection",
    slug: "trial-shorter-treatment-course",
    excerpt:
      "A randomised trial reports that a five-day course matched the standard ten-day regimen, with fewer side effects.",
    content: body(
      "A shorter course performed as well as the standard one.",
      [
        ["What the trial measured", "Researchers tracked recovery and relapse across two groups in eleven hospitals over eighteen months."],
        ["Why it matters", "Shorter courses reduce side effects and are one of the few levers known to slow antimicrobial resistance."],
        ["Caveats", "The trial excluded patients with compromised immune systems, so the result should not be extrapolated to that group."],
      ],
    ),
    meta_title: "Shorter treatment course matches standard",
    meta_description:
      "A randomised trial found a five-day treatment course matched a ten-day regimen, with fewer side effects.",
    keywords: ["health research", "clinical trial", "antibiotics", "treatment", "resistance"],
    featured_image_url: image("trial"),
    featured_image_alt: "Laboratory bench with sample trays",
    category_slug: "health",
    author: "Health & Lifestyle Desk",
    status: "published",
    reading_minutes: 4,
    views: 1330,
    faq: [
      { q: "How much shorter is the course?", a: "Five days instead of ten." },
      { q: "Who should not rely on this?", a: "Patients with compromised immune systems were excluded from the trial." },
      { q: "Has guidance changed?", a: "Not yet — guidelines typically follow a review of several trials." },
    ],
    key_takeaways: [
      "Five-day course matched ten days",
      "Fewer reported side effects",
      "Immune-compromised patients excluded",
      "Guidelines unchanged for now",
    ],
    published_at: daysAgo(1, 6),
    created_at: daysAgo(1, 6),
    updated_at: daysAgo(1, 6),
  },
  {
    id: "demo-5",
    title: "Streaming platform bets on shorter episodes as attention shifts",
    slug: "streaming-bets-on-shorter-episodes",
    excerpt:
      "Commissioners are ordering more half-hour formats after completion data showed viewers finishing short runs at twice the rate.",
    content: body(
      "Shorter formats are being commissioned at scale.",
      [
        ["The data behind it", "Internal figures showed completion rates roughly double for episodes under thirty minutes."],
        ["What is being ordered", "Six new half-hour dramas and a slate of returning factual series."],
        ["What it means for writers", "Shorter orders mean smaller writers' rooms and faster production cycles."],
      ],
    ),
    meta_title: "Streaming shifts to shorter episodes",
    meta_description:
      "A major streaming platform is commissioning half-hour formats after completion data showed viewers finishing them at twice the rate.",
    keywords: ["streaming", "television", "commissioning", "viewing habits", "entertainment"],
    featured_image_url: image("streaming"),
    featured_image_alt: "A television set in a dimly lit room",
    category_slug: "entertainment",
    author: "Entertainment & Culture Desk",
    status: "published",
    reading_minutes: 3,
    views: 780,
    faq: [
      { q: "How short are the episodes?", a: "Under thirty minutes for the new drama slate." },
      { q: "Why the change?", a: "Completion rates for short episodes were roughly double those of longer ones." },
    ],
    key_takeaways: [
      "Six new half-hour dramas ordered",
      "Completion doubles under thirty minutes",
      "Smaller writers' rooms, faster cycles",
    ],
    published_at: daysAgo(2, 9),
    created_at: daysAgo(2, 9),
    updated_at: daysAgo(2, 9),
  },
  {
    id: "demo-6",
    title: "Emergency crews restore power after storms cut supply to 90,000 homes",
    slug: "crews-restore-power-after-storms",
    excerpt:
      "Utilities say most customers should be reconnected within 24 hours, with isolated outages continuing into the weekend.",
    content: body(
      "Crews are working through the night to restore supply.",
      [
        ["Where things stand", "Around 90,000 homes lost power when a line of storms brought down trees and damaged substations."],
        ["Advice for residents", "Officials asked people to keep clear of downed lines and to check on elderly neighbours."],
        ["What happens next", "Isolated outages are expected to persist into the weekend as crews reach rural routes."],
      ],
    ),
    meta_title: "Power restored to most homes after storms",
    meta_description:
      "Utilities expect most of the 90,000 homes that lost power in overnight storms to be reconnected within 24 hours.",
    keywords: ["weather", "power outage", "emergency services", "storms", "infrastructure"],
    featured_image_url: image("storm"),
    featured_image_alt: "Utility crews working on overhead lines at dusk",
    category_slug: "breaking-news",
    author: "NewsSparkle Editorial Desk",
    status: "published",
    reading_minutes: 3,
    views: 4120,
    faq: [
      { q: "How many homes are affected?", a: "About 90,000 lost power at the peak of the storm." },
      { q: "When will power return?", a: "Most customers within 24 hours; isolated rural outages may last into the weekend." },
    ],
    key_takeaways: [
      "90,000 homes affected at peak",
      "Most restored within 24 hours",
      "Rural routes may wait until the weekend",
    ],
    published_at: daysAgo(0, 4),
    created_at: daysAgo(0, 4),
    updated_at: daysAgo(0, 6),
  },
  {
    id: "demo-7",
    title: "Housing starts rise for a second month as material costs ease",
    slug: "housing-starts-rise-second-month",
    excerpt:
      "Builders broke ground on more homes than forecast, though completions remain below the level needed to meet demand.",
    content: body(
      "Housing starts rose again, but completions lag.",
      [
        ["The numbers", "Starts increased for a second consecutive month, led by multi-unit projects."],
        ["Why completions lag", "Labour shortages in finishing trades remain the bottleneck, not materials."],
      ],
    ),
    meta_title: "Housing starts rise for a second month",
    meta_description:
      "Housing starts rose again as material costs eased, though completions remain below demand.",
    keywords: ["housing", "construction", "economy", "supply", "building"],
    featured_image_url: image("housing"),
    featured_image_alt: "Construction cranes above a housing development",
    category_slug: "business",
    author: "Business & Markets Desk",
    status: "published",
    reading_minutes: 4,
    views: 640,
    faq: [
      { q: "What drove the increase?", a: "Multi-unit projects, helped by easing material costs." },
      { q: "Why do completions lag?", a: "Shortages in finishing trades." },
    ],
    key_takeaways: ["Second consecutive monthly rise", "Led by multi-unit projects", "Finishing-trade labour is the bottleneck"],
    published_at: daysAgo(3, 7),
    created_at: daysAgo(3, 7),
    updated_at: daysAgo(3, 7),
  },
  {
    id: "demo-8",
    title: "City council approves night-time bus network after year-long pilot",
    slug: "council-approves-night-bus-network",
    excerpt:
      "Twelve routes will run until 3am on weekends, funded by a reallocation of the transport budget.",
    content: body(
      "Night buses become permanent after the pilot.",
      [
        ["What was approved", "Twelve routes running until 3am on Friday and Saturday nights."],
        ["How it is funded", "Money reallocated from an under-used park-and-ride programme."],
      ],
    ),
    meta_title: "Night bus network approved",
    meta_description:
      "Twelve night-time bus routes will run until 3am at weekends after a year-long pilot was judged a success.",
    keywords: ["transport", "public services", "city council", "buses", "policy"],
    featured_image_url: image("transit"),
    featured_image_alt: "A city bus at a stop after dark",
    category_slug: "politics",
    author: "Politics & Policy Desk",
    status: "published",
    reading_minutes: 3,
    views: 410,
    faq: [
      { q: "When do the routes start?", a: "The network begins operating next month." },
      { q: "Which nights?", a: "Friday and Saturday, until 3am." },
    ],
    key_takeaways: ["Twelve routes until 3am", "Weekends only", "Funded by reallocating an existing programme"],
    published_at: daysAgo(4, 8),
    created_at: daysAgo(4, 8),
    updated_at: daysAgo(4, 8),
  },
];

export const DEMO_CATEGORIES = [
  { id: "c1", name: "Breaking News", slug: "breaking-news", description: "Real-time alerts and urgent stories.", color: "#ef4444" },
  { id: "c2", name: "Politics", slug: "politics", description: "Elections, policy and governance.", color: "#2563eb" },
  { id: "c3", name: "Business", slug: "business", description: "Markets, economy and corporate news.", color: "#059669" },
  { id: "c4", name: "Technology", slug: "technology", description: "AI, products and cybersecurity.", color: "#7c3aed" },
  { id: "c5", name: "Health", slug: "health", description: "Medical research and wellbeing.", color: "#059669" },
  { id: "c6", name: "Entertainment", slug: "entertainment", description: "Film, music and culture.", color: "#db2777" },
];

export const DEMO_NOTIFICATIONS = [
  {
    id: "n1",
    slug: DEMO_POSTS[5].slug,
    title: DEMO_POSTS[5].title,
    excerpt: DEMO_POSTS[5].excerpt,
    image_url: DEMO_POSTS[5].featured_image_url,
    category_slug: "breaking-news",
    kind: "breaking" as const,
    created_at: daysAgo(0, 4),
    expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
  },
];
