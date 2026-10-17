// RSS 2.0 feed for the latest published posts.
//
// URL: https://<project-ref>.supabase.co/functions/v1/rss
//      ?category=<slug>  to filter by section

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeXml, xml } from "../_shared/http.ts";
import { SITE_NAME, siteUrl } from "../_shared/site.ts";

const SITE_DESC =
  "Your daily briefing on what matters — breaking news, politics, tech, business, health and entertainment.";

Deno.serve(async (req) => {
  const base = siteUrl();
  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  let query = supabase
    .from("posts")
    .select("slug,title,excerpt,author,category_slug,published_at,updated_at,featured_image_url,keywords")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);
  if (category) query = query.eq("category_slug", category);

  const { data: posts } = await query;
  const rows = (posts ?? []) as Array<{
    slug: string; title: string; excerpt: string | null; author: string | null;
    category_slug: string; published_at: string; updated_at: string | null;
    featured_image_url: string | null; keywords: string[] | null;
  }>;

  const feedUrl = `${base}/functions/v1/rss${category ? `?category=${encodeURIComponent(category)}` : ""}`;
  const lastBuild = rows.length > 0
    ? new Date(rows[0].updated_at || rows[0].published_at).toUTCString()
    : new Date().toUTCString();

  const items = rows.map((p) => {
    const link = `${base}/post/${p.slug}`;
    const categories = [p.category_slug, ...(p.keywords ?? [])]
      .filter(Boolean)
      .map((c) => `<category>${escapeXml(c)}</category>`)
      .join("");
    const enclosure = p.featured_image_url
      ? `<enclosure url="${escapeXml(p.featured_image_url)}" type="image/jpeg" />`
      : "";
    return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <author>editorial@newssparkle.lovable.app (${escapeXml(p.author || SITE_NAME)})</author>
      <description>${escapeXml(p.excerpt || "")}</description>
      ${categories}
      ${enclosure}
    </item>`;
  }).join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_NAME)}${category ? ` — ${escapeXml(category)}` : ""}</title>
    <link>${escapeXml(base)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(SITE_DESC)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>15</ttl>${items}
  </channel>
</rss>`;

  return xml(body, 600);
});
