// RSS 2.0 feed for the latest published posts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") || "https://newssparkle.lovable.app";
const SITE_NAME = "NewsSparkle";
const SITE_DESC = "Your daily briefing on what matters — breaking news, politics, tech, business, health and entertainment.";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  let q = supabase
    .from("posts")
    .select("slug, title, excerpt, author, category_slug, published_at, updated_at, featured_image_url, keywords")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);
  if (category) q = q.eq("category_slug", category);
  const { data: posts } = await q;

  const feedUrl = `${SITE_URL}/functions/v1/rss${category ? `?category=${category}` : ""}`;
  const lastBuild = posts && posts.length > 0 ? new Date(posts[0].updated_at).toUTCString() : new Date().toUTCString();

  const items = (posts || []).map((p) => {
    const link = `${SITE_URL}/post/${p.slug}`;
    const pubDate = new Date(p.published_at).toUTCString();
    const cats = [p.category_slug, ...((p.keywords as string[] | null) || [])]
      .filter(Boolean)
      .map((c) => `<category>${esc(c!)}</category>`)
      .join("");
    const enclosure = p.featured_image_url
      ? `<enclosure url="${esc(p.featured_image_url)}" type="image/jpeg" />`
      : "";
    return `
    <item>
      <title>${esc(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>noreply@newssparkle.app (${esc(p.author || SITE_NAME)})</author>
      <description>${esc(p.excerpt || "")}</description>
      ${cats}
      ${enclosure}
    </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${esc(SITE_NAME)}${category ? ` — ${esc(category)}` : ""}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <description>${esc(SITE_DESC)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>15</ttl>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
});
