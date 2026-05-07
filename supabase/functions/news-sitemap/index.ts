// Google News sitemap — last 48h of published articles.
// https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") || "https://newssparkle.lovable.app";
const PUBLICATION_NAME = "NewsSparkle";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: posts } = await supabase
    .from("posts")
    .select("slug, title, published_at, keywords")
    .eq("status", "published")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(1000);

  const items = (posts || []).map((p: { slug: string; title: string; published_at: string; keywords: string[] | null }) => `
    <url>
      <loc>${SITE_URL}/post/${p.slug}</loc>
      <news:news>
        <news:publication>
          <news:name>${PUBLICATION_NAME}</news:name>
          <news:language>en</news:language>
        </news:publication>
        <news:publication_date>${new Date(p.published_at).toISOString()}</news:publication_date>
        <news:title>${esc(p.title)}</news:title>
        ${p.keywords && p.keywords.length > 0 ? `<news:keywords>${esc(p.keywords.slice(0, 10).join(", "))}</news:keywords>` : ""}
      </news:news>
    </url>`).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${items}</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});
