import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RSS_URLS = [
  "http://feeds.reuters.com/reuters/topNews",
  "http://feeds.bbci.co.uk/news/rss.xml",
  "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
];

type FeedItem = { title: string; link?: string; snippet?: string; published?: string; source: string };

function normalizeHeadline(headline: string): string {
  return headline.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

async function parseFeed(xmlText: string, source: string): Promise<FeedItem[]> {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (!doc) return [];
  return Array.from(doc.querySelectorAll("item")).map((item) => ({
    title: item.querySelector("title")?.textContent?.trim() || "",
    link: item.querySelector("link")?.textContent?.trim() || item.querySelector("guid")?.textContent?.trim(),
    snippet: item.querySelector("description")?.textContent?.trim() || item.querySelector("summary")?.textContent?.trim(),
    published: item.querySelector("pubDate")?.textContent?.trim() || item.querySelector("updated")?.textContent?.trim(),
    source,
  })).filter((item) => !!item.title);
}

async function fetchBreakingFeed(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": "NewsSparkle-BreakingMonitor/1.0" } });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseFeed(xml, url);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const allItems = await Promise.all(RSS_URLS.map((url) => fetchBreakingFeed(url).catch(() => [])));
    const items = allItems.flat().sort((a, b) => {
      if (!a.published || !b.published) return 0;
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });

    const recent = await supabase.from("posts").select("title").eq("status", "published").gte("published_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    const existingTitles = new Set((recent.data || []).map((row: any) => normalizeHeadline(row.title)));

    const candidate = items.find((item) => !existingTitles.has(normalizeHeadline(item.title)));
    if (!candidate) {
      return new Response(JSON.stringify({ ok: true, message: "No new breaking item found." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const publishUrl = Deno.env.get("AUTO_PUBLISH_URL") || `${Deno.env.get("SITE_URL") || ""}/functions/v1/auto-publish`;
    if (!publishUrl || publishUrl.endsWith("/functions/v1/auto-publish") && !Deno.env.get("SITE_URL")) {
      return new Response(JSON.stringify({ ok: false, error: "AUTO_PUBLISH_URL or SITE_URL is not configured." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "breaking-news", slot: "morning", topic: candidate.title }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Auto-publish failed: ${response.status} ${text}`);
    }

    const body = await response.json();
    return new Response(JSON.stringify({ ok: true, triggered: true, candidate: candidate.title, publish: body }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("breaking-news-monitor fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});