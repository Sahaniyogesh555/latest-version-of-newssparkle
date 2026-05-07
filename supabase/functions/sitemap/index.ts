// Dynamic sitemap.xml served from edge function.
// Visit: /functions/v1/sitemap  (we'll redirect /sitemap.xml here via vite plugin OR expose URL)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") || "https://newssparkle.lovable.app";

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: posts } = await supabase.from("posts").select("slug, updated_at, published_at")
    .eq("status", "published").order("published_at", { ascending: false }).limit(2000);

  const cats = ["breaking-news","politics","business","technology","health","entertainment"];
  const staticUrls = ["", "about", "authors", "contact", "privacy", "privacy-policy", "terms", "disclaimer", "faq", "editorial-policy", "corrections", "brand", ...cats.map(c => `category/${c}`)];

  const urls = [
    ...staticUrls.map(p => `<url><loc>${SITE_URL}/${p}</loc><changefreq>${p === "" ? "hourly" : "weekly"}</changefreq><priority>${p === "" ? "1.0" : "0.7"}</priority></url>`),
    ...((posts || []).map(p => `<url><loc>${SITE_URL}/post/${p.slug}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`)),
  ].join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
});
