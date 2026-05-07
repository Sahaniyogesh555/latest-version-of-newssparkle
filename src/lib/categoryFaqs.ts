import { SITE } from "./site";

export type FAQ = { q: string; a: string };

export const CATEGORY_FAQS: Record<string, FAQ[]> = {
  "breaking-news": [
    {
      q: "How quickly is breaking news published on NewsSparkle?",
      a: `Our breaking desk surfaces verified developments throughout the day in three publishing slots — morning, midday and evening — so the section is refreshed continuously as events unfold.`,
    },
    {
      q: "Where do breaking news stories come from?",
      a: `Stories are sourced from verified wire services, official press releases and global trending feeds, then independently rewritten and fact-checked before publication.`,
    },
    {
      q: "How are breaking stories fact-checked?",
      a: `Every breaking story is cross-referenced against multiple primary sources and updated as soon as new verified information emerges. Corrections are disclosed transparently.`,
    },
    {
      q: "Can I follow only the biggest breaking events?",
      a: `Yes — bookmark the Breaking News section or check the homepage, which surfaces the highest-impact story of the moment as the lead.`,
    },
  ],
  "politics": [
    {
      q: "Does NewsSparkle cover politics with a political bias?",
      a: `${SITE.name} is editorially independent. We report what is happening, why it matters and what comes next, without endorsing parties, candidates or ideologies.`,
    },
    {
      q: "What kinds of political stories do you publish?",
      a: `Elections, government decisions, legislation, policy analysis and the real-world impact of political events on citizens and economies.`,
    },
    {
      q: "How often is the politics section updated?",
      a: `Politics receives fresh reporting in every daily publishing slot — morning briefings, midday explainers and evening analysis.`,
    },
    {
      q: "Do you cover international politics or only national?",
      a: `Both. Our politics desk follows major elections, diplomacy, geopolitical shifts and government decisions wherever they have measurable impact.`,
    },
  ],
  "business": [
    {
      q: "What does the Business & Economy section cover?",
      a: `Markets, jobs, inflation, central-bank decisions, startups, earnings, money tips and the macroeconomic forces shaping everyday life.`,
    },
    {
      q: "Is NewsSparkle business reporting financial advice?",
      a: `No. Our reporting is journalistic and informational. It is not personalised financial advice and should not be the sole basis for investment decisions.`,
    },
    {
      q: "Do you cover startups and entrepreneurship?",
      a: `Yes — funding rounds, founder stories, product launches and the trends shaping the global startup ecosystem are a regular part of the section.`,
    },
    {
      q: "How fresh is the business news on NewsSparkle?",
      a: `Business stories publish in three daily slots and the section is updated continuously as markets move and earnings are reported.`,
    },
  ],
  "technology": [
    {
      q: "What does the Technology & AI section cover?",
      a: `AI tools and models, app and mobile launches, software updates, cybersecurity, gadgets and the future-shaping trends across the global tech industry.`,
    },
    {
      q: "Do you cover AI launches and model releases?",
      a: `Yes — every major AI release, benchmark and product launch is covered with context on what changed and why it matters for users and businesses.`,
    },
    {
      q: "Are technology stories written by AI or humans?",
      a: `Our workflow is a hybrid: trending tech stories are surfaced by automated monitors, drafted with AI assistance using strict editorial prompts, then fact-checked against primary sources before publishing.`,
    },
    {
      q: "How can I keep up with new app and mobile launches?",
      a: `Visit the Technology & AI section daily — new launches, updates and reviews are published across our three daily slots.`,
    },
  ],
  "health": [
    {
      q: "Is the health content on NewsSparkle medical advice?",
      a: `No. Articles in the Health & Lifestyle section are journalistic and educational. Always consult a qualified healthcare professional for personal medical decisions.`,
    },
    {
      q: "What topics does the Health & Lifestyle section cover?",
      a: `Practical health tips, fitness, nutrition, mental health, sleep, longevity research and lifestyle trends backed by credible sources.`,
    },
    {
      q: "How are health claims verified?",
      a: `Health stories are checked against peer-reviewed research, official health bodies and recognised medical institutions before publication.`,
    },
    {
      q: "Do you cover mental health?",
      a: `Yes — mental health, stress management and emotional wellbeing are a regular and ongoing part of our Health & Lifestyle coverage.`,
    },
  ],
  "entertainment": [
    {
      q: "What does the Entertainment & Trending section cover?",
      a: `Celebrities, movies, streaming, music, viral reels trends, internet culture and the moments dominating global conversation right now.`,
    },
    {
      q: "How do you decide what is 'trending'?",
      a: `Our editorial monitors track verified trending feeds across global platforms in real time. Topics are then independently rewritten with context and source attribution.`,
    },
    {
      q: "Do you publish movie and show reviews?",
      a: `We publish news, explainers and analysis on releases, performances and cultural moments. Coverage focuses on context and impact rather than star ratings.`,
    },
    {
      q: "How often is the Entertainment section updated?",
      a: `New entertainment and trending stories publish in every daily slot — morning, midday and evening — to stay aligned with global culture cycles.`,
    },
  ],
};
