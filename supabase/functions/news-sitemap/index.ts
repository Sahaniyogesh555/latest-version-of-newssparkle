// Google News sitemap — the last 48 hours of published articles.
// https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
//
// URL: https://<project-ref>.supabase.co/functions/v1/news-sitemap

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeXml, xml } from "../_shared/http.ts";
import { SITE_NAME, siteUrl } from "../_shared/site.ts";

Deno.serve(async () => {
  const base = siteUrl();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await supabase
    .from("posts")
    .select("slug,title,published_at,keywords")
    .eq("status", "published")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(1000);

  const rows = (posts ?? []) as Array<{ slug: string; title: string; published_at: string; keywords: string[] | null }>;

  const items = rows.map((p) => `
    <url>
      <loc>${escapeXml(`${base}/post/${p.slug}`)}</loc>
      <news:news>
        <news:publication>
          <news:name>${escapeXml(SITE_NAME)}</news:name>
          <news:language>en</news:language>
        </news:publication>
        <news:publication_date>${new Date(p.published_at).toISOString()}</news:publication_date>
        <news:title>${escapeXml(p.title)}</news:title>
        ${p.keywords && p.keywords.length > 0 ? `<news:keywords>${escapeXml(p.keywords.slice(0, 10).join(", "))}</news:keywords>` : ""}
      </news:news>
    </url>`).join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${items}</urlset>`;

  return xml(body, 300);
});
