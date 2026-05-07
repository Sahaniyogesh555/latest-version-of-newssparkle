// Auto-publishing edge function — Smart Decision Engine
// Body: { category: string, slot: "morning"|"midday"|"evening", type?: string, topic?: string }
// Cron triggers this 18× per day across 6 categories × 3 slots.
// - morning  → NewsAPI (freshness)
// - midday   → SerpAPI Google News (trending)
// - evening  → SerpAPI deep + AI long-form (ranking)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = ["breaking-news", "politics", "business", "technology", "health", "entertainment"] as const;
type Cat = (typeof CATEGORIES)[number];
type Slot = "morning" | "midday" | "evening";

// NewsAPI category mapping
const NEWSAPI_CAT: Record<Cat, string> = {
  "breaking-news": "general",
  politics: "general",
  business: "business",
  technology: "technology",
  health: "health",
  entertainment: "entertainment",
};

// SerpAPI Google News topic tokens
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

interface SourceItem { title: string; url?: string; snippet?: string; source?: string; published?: string }

async function fetchNewsAPI(category: Cat): Promise<SourceItem[]> {
  const key = Deno.env.get("NEWSAPI_KEY");
  if (!key) throw new Error("NEWSAPI_KEY not configured");
  const cat = NEWSAPI_CAT[category];
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=10&category=${cat}`;
  const res = await fetch(url, { headers: { "X-Api-Key": key } });
  if (!res.ok) throw new Error(`NewsAPI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.articles || []).map((a: any) => ({
    title: a.title, url: a.url, snippet: a.description, source: a.source?.name, published: a.publishedAt,
  })).filter((i: SourceItem) => i.title && !i.title.includes("[Removed]"));
}

async function fetchSerpAPI(category: Cat): Promise<SourceItem[]> {
  const key = Deno.env.get("SERPAPI_KEY");
  if (!key) throw new Error("SERPAPI_KEY not configured");
  const q = encodeURIComponent(SERPAPI_QUERY[category]);
  const url = `https://serpapi.com/search.json?engine=google_news&q=${q}&hl=en&api_key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const items = (data.news_results || []).slice(0, 10);
  return items.map((a: any) => ({
    title: a.title, url: a.link, snippet: a.snippet, source: a.source?.name, published: a.date,
  })).filter((i: SourceItem) => i.title);
}

interface GeneratedPost {
  title: string; meta_title: string; meta_description: string; excerpt: string;
  content_markdown: string; keywords: string[]; key_takeaways: string[];
  faq: Array<{ q: string; a: string }>; featured_image_alt: string; reading_minutes: number;
}

async function generatePost(category: Cat, slot: Slot, sources: SourceItem[], topicHint?: string): Promise<GeneratedPost> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const wordTarget = slot === "evening" ? "900-1100" : slot === "midday" ? "700-900" : "600-800";
  const angle = slot === "evening"
    ? "deep analysis with background, expert framing, multiple angles, future outlook"
    : slot === "midday"
    ? "trending explainer focused on what's gaining attention right now"
    : "fast breaking-news brief that captures the latest facts clearly";

  const sourcesBlock = sources.slice(0, 6).map((s, i) =>
    `[${i+1}] ${s.title}${s.source ? ` — ${s.source}` : ""}${s.published ? ` (${s.published})` : ""}\n    ${s.snippet || ""}`,
  ).join("\n");

  const systemPrompt = `You are a senior journalist + SEO expert writing original news articles for a daily news website.
Output ONLY valid JSON via the tool call — no markdown wrapping.
Rules:
- Pick ONE clear story from the source headlines below; do NOT just list them.
- Rewrite in your own words, journalistic neutral tone, NEVER copy sentences verbatim.
- Headline: high-CTR, SEO, under 70 chars, includes focus keyword.
- Meta title 50-60 chars; meta description 150-160 chars.
- Body markdown: hook intro, ## H2 + ### H3 sections (background, latest developments, key facts, impact, what's next), short paragraphs, bold key terms, bullet lists where useful, conclusion.
- Word target: ${wordTarget}.
- Angle for this slot: ${angle}.
- 4 key takeaways, 3 FAQs, 6 SEO keywords (mix primary + long-tail).
- featured_image_alt: descriptive 8-14 words, includes main subject.`;

  const userPrompt = `Category: ${category.toUpperCase()} — Slot: ${slot.toUpperCase()}
${topicHint ? `Suggested angle: ${topicHint}\n` : ""}
Source headlines from today (use as research input, do not copy):
${sourcesBlock}

Write the article now.`;

  const tool = {
    type: "function",
    function: {
      name: "publish_article",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" }, meta_title: { type: "string" }, meta_description: { type: "string" },
          excerpt: { type: "string" }, content_markdown: { type: "string" },
          keywords: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 8 },
          key_takeaways: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
          faq: { type: "array", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q","a"] }, minItems: 2, maxItems: 4 },
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

function pickFeaturedImage(category: Cat, keywords: string[]): string {
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
    const api = slot === "morning" ? "newsapi" : "serpapi";

    let sources: SourceItem[] = [];
    let sourceErr: string | undefined;
    try {
      sources = api === "newsapi" ? await fetchNewsAPI(category) : await fetchSerpAPI(category);
    } catch (e) {
      sourceErr = (e as Error).message;
      // Fallback to the other API
      try {
        sources = api === "newsapi" ? await fetchSerpAPI(category) : await fetchNewsAPI(category);
      } catch { /* both failed; AI will work from topic hint only */ }
    }

    const article = await generatePost(category, slot, sources, body.topic);
    const slug = slugify(article.title);
    const featured_image_url = pickFeaturedImage(category, article.keywords);

    const { error } = await supabase.from("posts").insert({
      title: article.title, slug,
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
      ok: true, slug, category, slot, api_used: api,
      reason: slot === "morning" ? "scheduled-breaking" : slot === "midday" ? "scheduled-trending" : "scheduled-deep",
      sources_count: sources.length, source_warning: sourceErr,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("auto-publish fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
