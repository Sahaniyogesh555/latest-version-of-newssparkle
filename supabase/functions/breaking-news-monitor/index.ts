// Breaking news monitor — looks for a genuinely new top story and asks
// auto-publish to write it up.
//
// Scheduled every 30 minutes by pg_cron (see migration
// 20261016090100_phase6_autonomy_crons.sql). Requires the automation secret,
// because a run costs scraper + LLM calls.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";
import { requireSecret } from "../_shared/auth.ts";
import { parseFeedXml } from "../_shared/sources.ts";

// Note: the old Reuters RSS endpoints (feeds.reuters.com) were retired and
// returned nothing; these are live feeds.
const RSS_URLS = [
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
  "https://feeds.npr.org/1001/rss.xml",
];

type FeedItem = { title: string; link?: string; snippet?: string; published?: string; source: string };

function normalizeHeadline(headline: string): string {
  return headline.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// Deno has no DOMParser (checked on deno 2.9.6: `typeof DOMParser` is
// "undefined"), so feed parsing goes through the shared, regex-based parser the
// Phase 6 ingest pipeline uses. The old version threw a ReferenceError that the
// catch below swallowed, which is why the monitor never found anything.
async function parseFeed(xmlText: string, source: string): Promise<FeedItem[]> {
  const { items } = parseFeedXml(xmlText, { name: source });
  return items.map((item) => ({
    title: item.title,
    link: item.url,
    snippet: item.snippet,
    published: item.published,
    source,
  }));
}

async function fetchBreakingFeed(url: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NewsSparkle-BreakingMonitor/1.0 (+https://newssparkle.lovable.app)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const denied = requireSecret(req, { envVars: ["AUTO_PUBLISH_SECRET", "CRON_SECRET"] });
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const allItems = (await Promise.all(RSS_URLS.map(fetchBreakingFeed))).flat();
    const items = allItems.sort((a, b) => {
      if (!a.published || !b.published) return 0;
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });

    const recent = await supabase
      .from("posts")
      .select("title")
      .eq("status", "published")
      .gte("published_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(200);
    const existingTitles = new Set(
      ((recent.data ?? []) as Array<{ title: string }>).map((row) => normalizeHeadline(row.title)),
    );

    const candidate = items.find((item) => !existingTitles.has(normalizeHeadline(item.title)));
    if (!candidate) {
      return json({ ok: true, message: "No new breaking item found.", scanned: items.length });
    }

    const publishUrl = Deno.env.get("AUTO_PUBLISH_URL") ||
      `${supabaseUrl}/functions/v1/auto-publish`;
    const secret = Deno.env.get("AUTO_PUBLISH_SECRET") || Deno.env.get("CRON_SECRET") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const response = await fetch(publishUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ category: "breaking-news", slot: "morning", topic: candidate.title }),
      signal: AbortSignal.timeout(150_000),
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`Auto-publish failed: ${response.status} ${text}`);

    return json({ ok: true, triggered: true, candidate: candidate.title, source: candidate.source, publish: JSON.parse(text) });
  } catch (e) {
    console.error("breaking-news-monitor fatal:", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
