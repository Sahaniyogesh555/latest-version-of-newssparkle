// Auto-publishing edge function — Smart newsroom scheduler and article publisher
// Body: { category: string, slot: "morning"|"midday"|"evening", topic?: string }
// Target output: 18 posts daily across 6 categories × 3 slots.
// Source priority: RSS → Google Trends RSS → GNews API → NewsAPI → SerpAPI (selective).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewsAPIArticle {
  title: string;
  url: string;
  description?: string;
  source?: { name?: string };
  publishedAt: string;
}

interface NewsAPIResponse {
  articles?: NewsAPIArticle[];
}

interface SerpAPIArticle {
  title: string;
  link: string;
  snippet?: string;
  source?: { name?: string };
  date?: string;
}

interface SerpAPIResponse {
  news_results?: SerpAPIArticle[];
}

const CATEGORIES = ["breaking-news", "politics", "business", "technology", "health", "entertainment"] as const;
type Cat = (typeof CATEGORIES)[number];
type Slot = "morning" | "midday" | "evening";

type SourceItem = { title: string; url?: string; snippet?: string; source?: string; published?: string };

const RSS_FEEDS: Record<Cat, string[]> = {
  "breaking-news": [
    "http://feeds.reuters.com/reuters/topNews",
    "http://feeds.bbci.co.uk/news/rss.xml",
    "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
  ],
  politics: [
    "http://feeds.reuters.com/Reuters/PoliticsNews",
    "https://apnews.com/hub/politics/rss",
  ],
  business: [
    "https://www.cnbc.com/id/10001147/device/rss/rss.html",
    "https://finance.yahoo.com/news/rssindex",
    "https://www.bloomberg.com/markets/rss",
  ],
  technology: [
    "https://techcrunch.com/feed/",
    "https://www.theverge.com/rss/index.xml",
    "https://www.wired.com/feed/rss",
  ],
  health: [
    "https://www.healthline.com/rss",
    "https://www.who.int/feeds/entity/csr/don/en/rss.xml",
    "https://www.medicalnewstoday.com/rss",
  ],
  entertainment: [
    "https://variety.com/feed/",
    "https://www.billboard.com/feed/",
    "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
  ],
};

const GOOGLE_TRENDS_RSS = "https://trends.google.com/trends/trendingsearches/daily/rss?geo=US";

const GNEWS_QUERY: Record<Cat, string> = {
  "breaking-news": "breaking news latest",
  politics: "politics government elections",
  business: "business economy markets",
  technology: "technology AI innovation",
  health: "health wellness medical research",
  entertainment: "entertainment celebrity trending",
};

const NEWSAPI_CAT: Record<Cat, string> = {
  "breaking-news": "general",
  politics: "general",
  business: "business",
  technology: "technology",
  health: "health",
  entertainment: "entertainment",
};

const SERPAPI_QUERY: Record<Cat, string> = {
  "breaking-news": "breaking news today latest updates",
  politics: "politics government elections today",
  business: "business economy finance jobs today",
  technology: "technology AI apps news today",
  health: "health lifestyle fitness wellness today",
  entertainment: "entertainment celebrity viral trending today",
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 70) +
  "-" + Math.random().toString(36).slice(2, 7);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

function dedupeSources(items: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeText(item.title || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function parseRssItems(xmlText: string, sourceLabel: string): Promise<SourceItem[]> {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (!doc) return [];
  return Array.from(doc.querySelectorAll("item")).map((item) => ({
    title: item.querySelector("title")?.textContent?.trim() || "",
    url: item.querySelector("link")?.textContent?.trim() || item.querySelector("guid")?.textContent?.trim(),
    snippet: item.querySelector("description")?.textContent?.trim() || item.querySelector("summary")?.textContent?.trim(),
    source: sourceLabel,
    published: item.querySelector("pubDate")?.textContent?.trim() || item.querySelector("updated")?.textContent?.trim(),
  })).filter((item) => !!item.title);
}

async function fetchRssFromUrl(url: string): Promise<SourceItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": "NewsSparkle-RSS/1.0" } });
  if (!res.ok) return [];
  const text = await res.text();
  return parseRssItems(text, url);
}

async function fetchRss(category: Cat): Promise<SourceItem[]> {
  const urls = RSS_FEEDS[category] || [];
  const results = await Promise.all(urls.map((url) => fetchRssFromUrl(url).catch(() => [])));
  return dedupeSources(results.flat()).slice(0, 12);
}

async function fetchGoogleTrends(category: Cat): Promise<SourceItem[]> {
  const res = await fetch(GOOGLE_TRENDS_RSS, { headers: { "User-Agent": "NewsSparkle-Trends/1.0" } });
  if (!res.ok) return [];
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (!doc) return [];
  return Array.from(doc.querySelectorAll("item")).slice(0, 12).map((item) => ({
    title: item.querySelector("title")?.textContent?.trim() || "",
    url: item.querySelector("link")?.textContent?.trim() || undefined,
    snippet: item.querySelector("description")?.textContent?.trim() || undefined,
    source: "Google Trends",
    published: item.querySelector("pubDate")?.textContent?.trim() || undefined,
  })).filter((item) => !!item.title);
}

async function fetchGNews(category: Cat): Promise<SourceItem[]> {
  const key = Deno.env.get("GNEWS_API_KEY");
  if (!key) throw new Error("GNEWS_API_KEY not configured");
  const query = encodeURIComponent(GNEWS_QUERY[category]);
  const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=10&country=us&token=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GNews ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.articles || []).map((a: any) => ({
    title: a.title,
    url: a.url,
    snippet: a.description,
    source: a.source?.name || a.source,
    published: a.publishedAt,
  })).filter((item) => !!item.title);
}

async function fetchNewsAPI(category: Cat): Promise<SourceItem[]> {
  const key = Deno.env.get("NEWSAPI_KEY");
  if (!key) throw new Error("NEWSAPI_KEY not configured");
  const cat = NEWSAPI_CAT[category];
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=10&category=${cat}`;
  const res = await fetch(url, { headers: { "X-Api-Key": key } });
  if (!res.ok) throw new Error(`NewsAPI ${res.status}: ${await res.text()}`);
  const data: NewsAPIResponse = await res.json();
  return (data.articles || []).map((a: NewsAPIArticle) => ({
    title: a.title,
    url: a.url,
    snippet: a.description,
    source: a.source?.name,
    published: a.publishedAt,
  })).filter((item) => !!item.title && !item.title.includes("[Removed]"));
}

async function fetchSerpAPI(category: Cat): Promise<SourceItem[]> {
  const key = Deno.env.get("SERPAPI_KEY");
  if (!key) throw new Error("SERPAPI_KEY not configured");
  const q = encodeURIComponent(SERPAPI_QUERY[category]);
  const url = `https://serpapi.com/search.json?engine=google_news&q=${q}&hl=en&api_key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${await res.text()}`);
  const data: SerpAPIResponse = await res.json();
  const items = (data.news_results || []).slice(0, 10);
  return items.map((a: SerpAPIArticle) => ({
    title: a.title,
    url: a.link,
    snippet: a.snippet,
    source: a.source?.name,
    published: a.date,
  })).filter((item) => !!item.title);
}

async function collectSources(category: Cat, slot: Slot): Promise<SourceItem[]> {
  const gathered: SourceItem[] = [];
  const add = (items: SourceItem[]) => gathered.push(...items);

  if (slot === "morning") {
    add(await fetchRss(category));
    if (gathered.length < 6) {
      try { add(await fetchGNews(category)); } catch {}
    }
    if (gathered.length < 6) {
      try { add(await fetchNewsAPI(category)); } catch {}
    }
  } else if (slot === "midday") {
    add(await fetchGoogleTrends(category));
    if (gathered.length < 6) {
      add(await fetchRss(category));
    }
    if (gathered.length < 6) {
      try { add(await fetchSerpAPI(category)); } catch {}
    }
  } else {
    add(await fetchRss(category));
    add(await fetchGoogleTrends(category));
    try { add(await fetchGNews(category)); } catch {}
    try { add(await fetchNewsAPI(category)); } catch {}
    if (gathered.length < 10) {
      try { add(await fetchSerpAPI(category)); } catch {}
    }
  }

  return dedupeSources(gathered).slice(0, 12);
}

async function generatePost(category: Cat, slot: Slot, sources: SourceItem[], topicHint?: string): Promise<GeneratedPost> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const wordTarget = slot === "evening" ? "1200-2000" : slot === "midday" ? "500-800" : "250-450";
  const angle = slot === "evening"
    ? "deep analysis with background, expert framing, multiple angles, future outlook, timeline if relevant"
    : slot === "midday"
    ? "trending explainer focused on what is gaining attention now and why it matters"
    : "fast breaking-news brief that captures the latest facts clearly and verifies sources";

  const sourcesBlock = sources.slice(0, 7).map((s, i) =>
    `[${i + 1}] ${s.title}${s.source ? ` — ${s.source}` : ""}${s.published ? ` (${s.published})` : ""}\n    ${s.snippet || ""}`,
  ).join("\n");

  const systemPrompt = `You are a senior journalist and SEO expert writing original news articles for a daily newsroom.
Output ONLY valid JSON via the tool call — no markdown wrappers.
Rules:
- Pick ONE clear story from the source headlines below; do NOT just list them.
- Rewrite in your own words, with journalistic accuracy and neutral tone.
- Include a strong focus keyword and use it in title, meta description, first paragraph, headings, and image alt text.
- SEO title: <70 chars. Meta title: 50-60 chars. Meta description: 150-160 chars.
- Use H1 title, at least two H2 headings, and at least one H3 heading.
- Add at least two internal link anchors to other NewsSparkle articles.
- Include a related articles section with 3 short headline-style entries.
- For evening articles, include a FAQ section, detailed analysis, timeline if relevant, and expert insights if available.
- Use short paragraphs, bullet lists for readability, and a concise conclusion.
- Word target: ${wordTarget}.
- Angle: ${angle}.`;

  const userPrompt = `Category: ${category.toUpperCase()} — Slot: ${slot.toUpperCase()}
${topicHint ? `Suggested angle: ${topicHint}\n` : ""}
Sources (use as research input, do not copy):
${sourcesBlock}

Write the article now.`;

  const tool = {
    type: "function",
    function: {
      name: "publish_article",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          meta_title: { type: "string" },
          meta_description: { type: "string" },
          excerpt: { type: "string" },
          content_markdown: { type: "string" },
          keywords: { type: "array", items: { type: "string" }, minItems: 6, maxItems: 8 },
          key_takeaways: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 6 },
          faq: { type: "array", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q","a"] }, minItems: 3, maxItems: 5 },
          featured_image_alt: { type: "string" },
          reading_minutes: { type: "integer" },
        },
        required: ["title","meta_title","meta_description","excerpt","content_markdown","keywords","key_takeaways","faq","featured_image_alt","reading_minutes"],
        additionalProperties: false,
      },
    },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "publish_article" } },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) throw new Error("AI rate limit");
    if (res.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI gateway ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI returned no tool call");
  return JSON.parse(call.function.arguments) as GeneratedPost;
}

async function pickFeaturedImage(category: Cat, keywords: string[]): Promise<string> {
  const kw = encodeURIComponent((keywords[0] || category).replace(/[^a-z0-9 ]/gi, ""));
  return `https://source.unsplash.com/1600x900/?${kw},${category}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    let body: { category?: string; slot?: Slot; topic?: string } = {};
    try { body = await req.json(); } catch { /* GET */ }

    const category = (CATEGORIES.includes(body.category as Cat) ? body.category : "breaking-news") as Cat;
    const slot: Slot = (["morning","midday","evening"].includes(body.slot as string) ? body.slot : "midday") as Slot;

    const sources = await collectSources(category, slot);
    const article = await generatePost(category, slot, sources, body.topic);
    const slug = slugify(article.title);
    const featured_image_url = await pickFeaturedImage(category, article.keywords);

    const { error } = await supabase.from("posts").insert({
      title: article.title,
      slug,
      excerpt: article.excerpt,
      content: article.content_markdown,
      meta_title: article.meta_title.slice(0, 60),
      meta_description: article.meta_description.slice(0, 160),
      keywords: article.keywords,
      featured_image_url,
      featured_image_alt: article.featured_image_alt,
      category_slug: category,
      reading_minutes: article.reading_minutes,
      key_takeaways: article.key_takeaways,
      faq: article.faq,
      status: "published",
      published_at: new Date().toISOString(),
    });

    if (error) throw new Error(`DB insert: ${error.message}`);

    return new Response(JSON.stringify({
      ok: true,
      slug,
      category,
      slot,
      sources_count: sources.length,
      reason: slot === "morning" ? "scheduled-breaking" : slot === "midday" ? "scheduled-trending" : "scheduled-deep",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("auto-publish fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
