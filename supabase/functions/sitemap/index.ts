// Dynamic sitemap.xml served from edge function.
// Visit: /functions/v1/sitemap  (we'll redirect /sitemap.xml here via vite plugin OR expose URL)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") || "https://newssparkle.lovable.app";

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

  // Get all published posts
  const { data: posts } = await supabase.from("posts").select("slug, updated_at, published_at")
    .eq("status", "published").order("published_at", { ascending: false }).limit(2000);

  // Get all categories dynamically
  const { data: categories } = await supabase.from("categories").select("slug").limit(50);

  // Static pages including new trust pages
  const staticUrls = [
    "", // homepage
    "about",
    "authors",
    "contact",
    "privacy",
    "privacy-policy",
    "terms",
    "disclaimer",
    "faq",
    "brand",
    "editorial-policy",
    "corrections",
    "search",
    "bookmarks"
  ];

  const authorSlugs = [
    "editorial-desk",
    "politics-desk",
    "business-desk",
    "technology-desk",
    "health-desk",
    "entertainment-desk",
  ];

  // Add category pages
  const categoryUrls = (categories || []).map((cat: { slug: string }) => `category/${cat.slug}`);

  // Add author pages
  const authorUrls = authorSlugs.map((slug) => `author/${slug}`);

  // Add tag pages from post keywords
  const tags = new Set<string>();
  (posts || []).forEach((p: { keywords: string[] | null }) => {
    (p.keywords || []).forEach((keyword) => {
      const normalized = keyword?.trim().toLowerCase();
      if (normalized) tags.add(normalized);
    });
  });

  const tagUrls = [...tags].slice(0, 500).map((tag) => `tag/${encodeURIComponent(tag)}`);

  // Combine all URLs
  const allStaticUrls = [...staticUrls, ...categoryUrls, ...authorUrls, ...tagUrls];

  const urls = [
    // Static pages
    ...allStaticUrls.map(p => `<url><loc>${SITE_URL}/${p}</loc><changefreq>${p === "" ? "hourly" : "weekly"}</changefreq><priority>${p === "" ? "1.0" : "0.7"}</priority></url>`),
    // Article pages
    ...((posts || []).map(p => `<url><loc>${SITE_URL}/post/${p.slug}</loc><lastmod>${new Date(p.updated_at || p.published_at).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`)),
  ].join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900"
    }
  });
});
